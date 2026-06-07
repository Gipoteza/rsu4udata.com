import React from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';

// Mixed chart: Line + Column + Area
// https://apexcharts.com/react-chart-demos/mixed-charts/line-column-area/
export default function MixedChart() {
  const series = [
    {
      name: 'Расходы',
      type: 'column',
      data: [23, 11, 22, 27, 13, 22, 37, 21, 44, 22, 30],
    },
    {
      name: 'Доход',
      type: 'area',
      data: [44, 55, 41, 67, 22, 43, 21, 41, 56, 27, 43],
    },
    {
      name: 'Прибыль',
      type: 'line',
      data: [30, 25, 36, 30, 45, 35, 64, 52, 59, 36, 39],
    },
  ];

  const options: ApexOptions = {
    chart: {
      height: 350,
      type: 'line',
      stacked: false,
      toolbar: { show: false },
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    stroke: {
      width: [0, 2, 4],
      curve: 'smooth',
    },
    plotOptions: {
      bar: { columnWidth: '50%', borderRadius: 4 },
    },
    fill: {
      opacity: [0.85, 0.25, 1],
      gradient: {
        inverseColors: false,
        shade: 'light',
        type: 'vertical',
        opacityFrom: 0.85,
        opacityTo: 0.55,
        stops: [0, 100, 100, 100],
      },
    },
    colors: ['#4f46e5', '#16a34a', '#ea580c'],
    labels: [
      '01 Янв', '02 Янв', '03 Янв', '04 Янв', '05 Янв', '06 Янв',
      '07 Янв', '08 Янв', '09 Янв', '10 Янв', '11 Янв',
    ],
    markers: { size: 0 },
    xaxis: { type: 'category' },
    yaxis: {
      title: { text: 'Значение' },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (y: number) => (typeof y !== 'undefined' ? `${y.toFixed(0)} €` : y),
      },
    },
    legend: { position: 'top' },
  };

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
      <ReactApexChart options={options} series={series} type="line" height={350} />
    </div>
  );
}
