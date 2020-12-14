import React, { useEffect, useMemo, useRef } from "react";

import echarts from "echarts/lib/echarts";

export const TokenChart = (props: {
  mintAddress: string[];
}) => {
  const chartDiv = useRef<HTMLDivElement>(null);

  // dispose chart
  useEffect(() => {
    const div = chartDiv.current;
    return () => {
      let instance = div && echarts.getInstanceByDom(div);
      instance && instance.dispose();
    };
  }, []);

  useEffect(() => {
    if (!chartDiv.current) {
      return;
    }

    let instance = echarts.getInstanceByDom(chartDiv.current);
    console.log(instance);

    chartDiv.current.height = 350;
    chartDiv.current.width = 308;

    if (!instance) {
      instance = echarts.init(chartDiv.current);
    }
    console.log(instance);

    const data = [
      {
        name: "test",
        value: 50,
      },
      {
        name: "test3",
        value: 50,
      },
    ];

    instance.setOption({
      // tooltip: {
      //   trigger: "item",
      //   formatter: function (params: any) {
      //     var val = 100;
      //     return `${params.name}: \n${val}`;
      //   },
      // },
      series: [{
        name: 'Machine Time',
        type: 'gauge',
        splitNumber: 10,
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#228b22'],
                    [0.8, '#48b'],
                    [1, '#ff4500']
                ],
                width: 8
            }
        },
        axisTick: {
            splitNumber: 10,
            length: 12,
            lineStyle: {
                color: 'auto'
            }
        },
        axisLabel: {
            textStyle: {
                color: 'auto'
            }
        },
        splitLine: {
            show: true,
            length: 30,
            lineStyle: {
                color: 'auto'
            }
        },
        pointer: {
            width: 5
        },

        detail: {
            formatter: '{value}%',
            textStyle: {
                color: 'auto',
                fontWeight: 'bolder'
            }
        },
        data: [{
            value: 50,
            name: 'Process'
        }]
    }],

    });
    console.log(chartDiv);

    // var chartOuterDiv = document.querySelector('#chartOuterDiv');
    // chartOuterDiv.appendChild(chartDiv.current);
  }, []);

  console.log(chartDiv);
  return <div ref={chartDiv} style={{ height: 350, width: "100%" }} />;
};
export default TokenChart;
