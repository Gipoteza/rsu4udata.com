import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';

interface BranchStatus {
  branchId: number;
  branchName: string;
  status: 'connected' | 'requires_reconnect' | 'not_connected';
  baseDomain: string | null;
}

interface Row {
  name: string;
  phone: string;
  note: string;
}

interface ImportResult {
  requested: number;
  createdCount: number;
  mergedCount: number;
  failedCount: number;
  notesAdded: number;
  noteErrors: string[];
  invalid: string[];
  tags: string[];
  created: { name: string; phone: string; leadId: number; merged: boolean }[];
  failed: { phone: string; error: string }[];
}

const COLS: (keyof Row)[] = ['name', 'phone', 'note'];
const MAX_ROWS = 500;
const emptyRow = (): Row => ({ name: '', phone: '', note: '' });

// Тот же критерий валидности, что и на бэкенде: 9–15 цифр
function isValidPhone(raw: string): boolean {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function detectDelimiter(text: string): string {
  if (text.includes('\t')) return '\t';
  if (text.includes(';')) return ';';
  return ',';
}

export default function ImportClientsPage() {
  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 8 }, emptyRow));

  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // --- Загрузка городов ------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ statuses: BranchStatus[] }>('/integrations/kommo/status');
        setBranches(res.data.statuses);
        const firstConnected = res.data.statuses.find((s) => s.status === 'connected');
        if (firstConnected) setBranchId(firstConnected.branchId);
      } catch {
        setError('Не вдалося завантажити список міст');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- Загрузка тегов выбранного города -------------------------------------
  useEffect(() => {
    if (!branchId) return;
    setTags([]);
    setSelectedTags(new Set());
    setTagSearch('');
    loadTags(branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const loadTags = async (id: number) => {
    setTagsLoading(true);
    try {
      const res = await api.get<{ id: number; name: string }[]>(`/integrations/kommo/tags/${id}`);
      setTags(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Не вдалося завантажити теги міста');
    } finally {
      setTagsLoading(false);
    }
  };

  const toggleTag = (name: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const visibleTags = useMemo(() => {
    const q = tagSearch.toLowerCase().trim();
    const filtered = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
    return [...filtered].sort((a, b) => {
      const aSel = selectedTags.has(a.name) ? 0 : 1;
      const bSel = selectedTags.has(b.name) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return a.name.localeCompare(b.name, 'uk');
    });
  }, [tags, tagSearch, selectedTags]);

  // --- Работа с таблицей ----------------------------------------------------
  const setCell = (rowIdx: number, col: keyof Row, value: string) => {
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      next[rowIdx][col] = value;
      // Автодобавление строки при заполнении последней
      if (rowIdx === next.length - 1 && value.trim() && next.length < MAX_ROWS) {
        next.push(emptyRow());
      }
      return next;
    });
  };

  const addRows = (count: number) => {
    setRows((prev) => {
      const room = Math.max(0, MAX_ROWS - prev.length);
      return [...prev, ...Array.from({ length: Math.min(count, room) }, emptyRow)];
    });
  };

  const removeRow = (rowIdx: number) => {
    setRows((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, i) => i !== rowIdx)));
  };

  const clearTable = () => {
    setRows(Array.from({ length: 8 }, emptyRow));
    setResult(null);
    setNotice('');
    setError('');
  };

  // Вставка блока из Google Sheets / Excel: раскладываем по строкам и колонкам
  const applyMatrix = (matrix: string[][], startRow: number, startCol: number) => {
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      const needed = Math.min(startRow + matrix.length, MAX_ROWS);
      while (next.length < needed) next.push(emptyRow());
      matrix.forEach((cells, r) => {
        const targetRow = startRow + r;
        if (targetRow >= MAX_ROWS || targetRow >= next.length) return;
        cells.forEach((cell, c) => {
          const col = COLS[startCol + c];
          if (!col) return;
          next[targetRow][col] = String(cell).trim();
        });
      });
      if (next.length < MAX_ROWS && next[next.length - 1] && Object.values(next[next.length - 1]).some((v) => v.trim())) {
        next.push(emptyRow());
      }
      return next;
    });
  };

  const handlePaste = (e: React.ClipboardEvent, rowIdx: number, colIdx: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || !/[\t\r\n]/.test(text)) return; // одиночное значение — обычная вставка
    e.preventDefault();
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
    const hasTabs = text.includes('\t');
    const matrix = lines.map((l) => (hasTabs ? l.split('\t') : [l]));
    applyMatrix(matrix, rowIdx, colIdx);
    setNotice(`Вставлено рядків: ${matrix.length}`);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) return;
    const delim = detectDelimiter(text);
    let matrix = lines.map((l) => l.split(delim));
    // Пропускаем строку заголовков, если в ней нет телефона
    if (matrix.length > 1 && !matrix[0].some((c) => isValidPhone(c))) {
      matrix = matrix.slice(1);
    }
    // Нормализуем к 3 колонкам: имя, телефон, опис
    const normalized = matrix.map((cells) => {
      if (cells.length === 1) return ['', cells[0], ''];
      const phoneIdx = cells.findIndex((c) => isValidPhone(c));
      if (phoneIdx === -1) return [cells[0] || '', '', cells.slice(1).join(' ')];
      return [
        cells.slice(0, phoneIdx).join(' '),
        cells[phoneIdx],
        cells.slice(phoneIdx + 1).join(' '),
      ];
    });
    setRows(Array.from({ length: 0 }, emptyRow));
    applyMatrix(normalized, 0, 0);
    setNotice(`Завантажено рядків з файлу: ${normalized.length}`);
    if (fileRef.current) fileRef.current.value = '';
  };

  // --- Подсчёты -------------------------------------------------------------
  const filledRows = rows.filter((r) => r.name.trim() || r.phone.trim() || r.note.trim());
  const validRows = filledRows.filter((r) => isValidPhone(r.phone));
  const invalidRows = filledRows.filter((r) => !isValidPhone(r.phone));
  const uniqueValid = useMemo(() => {
    const seen = new Set<string>();
    return validRows.filter((r) => {
      const key = r.phone.replace(/\D/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedBranch = branches.find((b) => b.branchId === branchId);
  const connectedBranches = branches.filter((b) => b.status === 'connected');

  // --- Создание сделок ------------------------------------------------------
  const handleCreate = async () => {
    setError('');
    setNotice('');
    setResult(null);

    if (!branchId) {
      setError('Виберіть місто');
      return;
    }
    if (uniqueValid.length === 0) {
      setError('Немає жодного коректного номера телефону');
      return;
    }

    const confirmed = window.confirm(
      `Створити ${uniqueValid.length} угод у Kommo (${selectedBranch?.branchName})`
      + `${selectedTags.size > 0 ? ` з тегами: ${Array.from(selectedTags).join(', ')}` : ' без тегів'}?`
    );
    if (!confirmed) return;

    setCreating(true);
    try {
      const res = await api.post<ImportResult>(`/integrations/kommo/import-clients/${branchId}`, {
        rows: uniqueValid.map((r) => ({ name: r.name, phone: r.phone, note: r.note })),
        tagNames: Array.from(selectedTags),
      });
      setResult(res.data);
      setNotice('Готово');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Не вдалося створити угоди');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div style={styles.loading}>Завантаження...</div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Імпорт клієнтів</h1>
      <p style={styles.subtitle}>
        Завантажте список клієнтів, виберіть місто та теги — угоди будуть створені в Kommo цього міста
      </p>

      <div style={styles.infoBox}>
        Таблицю можна заповнити вручну або вставити з Google Таблиць: скопіюйте діапазон
        (Ім’я / Телефон / Опис) і натисніть <b>Ctrl+V</b> у першій клітинці. Також можна завантажити
        CSV/TSV файл. Опис зберігається як примітка до угоди. Дату створення Kommo проставляє сам.
        Максимум {MAX_ROWS} рядків за раз.
      </div>

      {notice && <div style={styles.notice}>{notice}</div>}
      {error && <div style={styles.error}>{error}</div>}

      {connectedBranches.length === 0 && (
        <div style={styles.error}>
          Немає підключених акаунтів Kommo. Спочатку підключіть місто в розділі «Kommo CRM».
        </div>
      )}

      <div style={styles.layout}>
        {/* Левая колонка: таблица */}
        <div style={styles.tableCard}>
          <div style={styles.tableToolbar}>
            <span style={styles.tableTitle}>Список клієнтів</span>
            <div style={styles.toolbarActions}>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <button style={styles.smallBtn} onClick={() => fileRef.current?.click()}>
                Завантажити файл
              </button>
              <button style={styles.smallBtn} onClick={() => addRows(10)}>+ 10 рядків</button>
              <button style={styles.smallBtnDanger} onClick={clearTable}>Очистити</button>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '44px' }}>#</th>
                  <th style={styles.th}>Ім’я</th>
                  <th style={styles.th}>Телефон</th>
                  <th style={styles.th}>Опис угоди</th>
                  <th style={{ ...styles.th, width: '40px' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => {
                  const filled = row.name.trim() || row.phone.trim() || row.note.trim();
                  const badPhone = !!filled && !isValidPhone(row.phone);
                  return (
                    <tr key={rowIdx}>
                      <td style={styles.tdIndex}>{rowIdx + 1}</td>
                      {COLS.map((col, colIdx) => (
                        <td key={col} style={styles.td}>
                          <input
                            style={{
                              ...styles.cellInput,
                              ...(col === 'phone' && badPhone ? styles.cellInputError : {}),
                            }}
                            value={row[col]}
                            onChange={(e) => setCell(rowIdx, col, e.target.value)}
                            onPaste={(e) => handlePaste(e, rowIdx, colIdx)}
                            placeholder={
                              col === 'name' ? 'Іван Петренко'
                                : col === 'phone' ? '+380671234567'
                                  : 'Коментар до угоди'
                            }
                          />
                        </td>
                      ))}
                      <td style={styles.td}>
                        <button
                          style={styles.rowDelete}
                          onClick={() => removeRow(rowIdx)}
                          title="Видалити рядок"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={styles.counters}>
            Заповнено рядків: <b>{filledRows.length}</b> · до створення: <b>{uniqueValid.length}</b>
            {invalidRows.length > 0 && (
              <span style={styles.counterBad}> · некоректний телефон: {invalidRows.length}</span>
            )}
            {validRows.length - uniqueValid.length > 0 && (
              <span style={styles.counterWarn}> · дублікатів: {validRows.length - uniqueValid.length}</span>
            )}
          </div>
        </div>

        {/* Правая колонка: город, теги, кнопка */}
        <div style={styles.sideCard}>
          <label style={styles.label}>Місто (акаунт Kommo)</label>
          <select
            style={styles.select}
            value={branchId ?? ''}
            onChange={(e) => setBranchId(Number(e.target.value) || null)}
          >
            <option value="">— виберіть місто —</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId} disabled={b.status !== 'connected'}>
                {b.branchName}{b.status !== 'connected' ? ' (не підключено)' : ''}
              </option>
            ))}
          </select>

          <div style={styles.tagsHeader}>
            <span style={styles.label}>Теги цього міста</span>
            <button
              style={styles.tagsReload}
              onClick={() => branchId && loadTags(branchId)}
              disabled={!branchId || tagsLoading}
              title="Оновити список тегів"
            >
              {tagsLoading ? '...' : '⟳'}
            </button>
          </div>

          <input
            style={styles.input}
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            placeholder="Пошук по тегах..."
            disabled={!branchId}
          />

          <div style={styles.tagList}>
            {visibleTags.map((t) => (
              <label key={t.id} style={styles.tagRow}>
                <input
                  type="checkbox"
                  checked={selectedTags.has(t.name)}
                  onChange={() => toggleTag(t.name)}
                />
                <span>{t.name}</span>
              </label>
            ))}
            {!tagsLoading && tags.length === 0 && (
              <span style={styles.noTags}>
                {branchId ? 'Теги не знайдені' : 'Виберіть місто'}
              </span>
            )}
            {!tagsLoading && tags.length > 0 && visibleTags.length === 0 && (
              <span style={styles.noTags}>Нічого не знайдено</span>
            )}
          </div>

          {selectedTags.size > 0 && (
            <div style={styles.selectedTags}>
              Вибрано: {Array.from(selectedTags).join(', ')}
            </div>
          )}

          <button
            style={{
              ...styles.createBtn,
              ...(creating || !branchId || uniqueValid.length === 0 ? styles.createBtnDisabled : {}),
            }}
            disabled={creating || !branchId || uniqueValid.length === 0}
            onClick={handleCreate}
          >
            {creating ? 'Створення...' : `Створити (${uniqueValid.length})`}
          </button>
        </div>
      </div>

      {result && (
        <div style={styles.resultCard}>
          <div style={styles.resultTitle}>Результат імпорту</div>
          <div style={styles.resultRow}>
            <span style={styles.statOk}>Створено: {result.createdCount}</span>
            {result.mergedCount > 0 && (
              <span style={styles.statWarn}>Об’єднано з дублікатами: {result.mergedCount}</span>
            )}
            {result.notesAdded > 0 && (
              <span style={styles.statInfo}>Приміток додано: {result.notesAdded}</span>
            )}
            {result.failedCount > 0 && (
              <span style={styles.statBad}>Помилок: {result.failedCount}</span>
            )}
          </div>

          {result.tags.length > 0 && (
            <div style={styles.resultNote}>Теги: {result.tags.join(', ')}</div>
          )}

          {result.invalid.length > 0 && (
            <div style={styles.resultNote}>
              Пропущені рядки ({result.invalid.length}): {result.invalid.slice(0, 10).join(' | ')}
              {result.invalid.length > 10 ? ' …' : ''}
            </div>
          )}

          {result.noteErrors.length > 0 && (
            <div style={styles.resultNote}>Помилки приміток: {result.noteErrors.join(' | ')}</div>
          )}

          {result.failed.length > 0 && (
            <div style={styles.failList}>
              {result.failed.slice(0, 20).map((f, i) => (
                <div key={i} style={styles.failRow}>{f.phone} — {f.error}</div>
              ))}
              {result.failed.length > 20 && (
                <div style={styles.failRow}>… та ще {result.failed.length - 20}</div>
              )}
            </div>
          )}

          {result.created.length > 0 && (
            <details style={styles.details}>
              <summary style={styles.summary}>Створені угоди ({result.created.length})</summary>
              <div style={styles.createdList}>
                {result.created.map((c, i) => (
                  <div key={i} style={styles.createdRow}>
                    {c.name} — {c.phone} — угода #{c.leadId}
                    {c.merged ? ' (дублікат, об’єднано)' : ''}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  title: { fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px 0' },
  subtitle: { fontSize: '14px', color: '#8892a4', margin: '0 0 20px 0' },
  loading: { padding: '32px', color: '#8892a4' },
  infoBox: {
    padding: '12px 16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd',
    borderRadius: '8px', fontSize: '13px', color: '#0c4a6e', marginBottom: '16px', lineHeight: 1.5,
  },
  notice: {
    padding: '10px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: '8px', color: '#15803d', fontSize: '14px', marginBottom: '12px',
  },
  error: {
    padding: '10px 16px', backgroundColor: '#fff5f5', border: '1px solid #fed7d7',
    borderRadius: '8px', color: '#e53e3e', fontSize: '14px', marginBottom: '12px',
  },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '16px', alignItems: 'start' },
  tableCard: {
    backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px',
  },
  tableToolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '12px', flexWrap: 'wrap', gap: '8px',
  },
  tableTitle: { fontSize: '15px', fontWeight: 600, color: '#1a1a2e' },
  toolbarActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  smallBtn: {
    padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff',
    color: '#475569', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
  },
  smallBtnDanger: {
    padding: '7px 12px', border: '1px solid #fecaca', borderRadius: '8px', background: '#fff',
    color: '#dc2626', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
  },
  tableWrap: { maxHeight: '460px', overflow: 'auto', border: '1px solid #f1f5f9', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    position: 'sticky', top: 0, backgroundColor: '#f8fafc', textAlign: 'left',
    padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: '#64748b',
    borderBottom: '1px solid #e2e8f0', zIndex: 1,
  },
  td: { padding: '2px 4px', borderBottom: '1px solid #f1f5f9' },
  tdIndex: {
    padding: '2px 8px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8',
    fontSize: '12px', textAlign: 'center', backgroundColor: '#fafafa',
  },
  cellInput: {
    width: '100%', boxSizing: 'border-box', padding: '7px 8px', border: '1px solid transparent',
    borderRadius: '6px', fontSize: '13px', color: '#1a1a2e', outline: 'none', background: 'transparent',
  },
  cellInputError: { border: '1px solid #fca5a5', backgroundColor: '#fff5f5' },
  rowDelete: {
    border: 'none', background: 'none', color: '#cbd5e1', cursor: 'pointer',
    fontSize: '18px', lineHeight: 1, padding: '0 4px',
  },
  counters: { marginTop: '10px', fontSize: '12px', color: '#64748b' },
  counterBad: { color: '#dc2626' },
  counterWarn: { color: '#ea580c' },
  sideCard: {
    backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  label: { fontSize: '12px', fontWeight: 600, color: '#64748b' },
  select: {
    padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', color: '#1a1a2e', outline: 'none', backgroundColor: '#fafafa',
  },
  input: {
    padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', color: '#1a1a2e', outline: 'none', backgroundColor: '#fafafa',
  },
  tagsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' },
  tagsReload: {
    border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: '#64748b',
    cursor: 'pointer', fontSize: '13px', width: '26px', height: '26px',
  },
  tagList: {
    display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '220px', overflow: 'auto',
    border: '1px solid #f1f5f9', borderRadius: '8px', padding: '8px',
  },
  tagRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' },
  noTags: { fontSize: '12px', color: '#94a3b8' },
  selectedTags: { fontSize: '12px', color: '#475569', lineHeight: 1.4 },
  createBtn: {
    marginTop: '8px', padding: '11px', border: 'none', borderRadius: '8px',
    backgroundColor: '#16a34a', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
  createBtnDisabled: { backgroundColor: '#cbd5e1', cursor: 'not-allowed' },
  resultCard: {
    marginTop: '16px', backgroundColor: '#fff', border: '1px solid #e2e8f0',
    borderRadius: '12px', padding: '16px',
  },
  resultTitle: { fontSize: '15px', fontWeight: 600, color: '#1a1a2e', marginBottom: '10px' },
  resultRow: { display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', fontWeight: 600 },
  statOk: { color: '#16a34a' },
  statWarn: { color: '#ea580c' },
  statInfo: { color: '#0284c7' },
  statBad: { color: '#dc2626' },
  resultNote: { marginTop: '8px', fontSize: '12px', color: '#64748b', lineHeight: 1.5 },
  failList: {
    marginTop: '10px', maxHeight: '160px', overflow: 'auto', backgroundColor: '#fff5f5',
    border: '1px solid #fed7d7', borderRadius: '8px', padding: '8px',
  },
  failRow: { fontSize: '12px', color: '#b91c1c', lineHeight: 1.5 },
  details: { marginTop: '10px' },
  summary: { fontSize: '13px', color: '#4f46e5', cursor: 'pointer' },
  createdList: { marginTop: '8px', maxHeight: '200px', overflow: 'auto' },
  createdRow: { fontSize: '12px', color: '#334155', lineHeight: 1.6 },
};
