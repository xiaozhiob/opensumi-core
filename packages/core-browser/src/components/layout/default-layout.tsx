import React from 'react';

import { SlotRenderer } from '../../react-providers/slot';

import { BoxPanel } from './box-panel';
import { SplitPanel } from './split-panel';

export const getStorageValue = () => {
  // 启动时渲染的颜色和尺寸，弱依赖
  let savedLayout: { [key: string]: { size: number; currentId: string } } = {};
  let savedColors: { [colorKey: string]: string } = {};
  try {
    savedLayout = JSON.parse(localStorage.getItem('layout') || '{}');
    savedColors = JSON.parse(localStorage.getItem('theme') || '{}');
  } catch (err) {}
  return {
    layout: savedLayout,
    colors: savedColors,
  };
};

export const DefaultLayout = ToolbarActionBasedLayout;

export function ToolbarActionBasedLayout(
  props: {
    topSlotDefaultSize?: number;
    topSlotZIndex?: number;
  } = {},
) {
  const { layout } = getStorageValue();
  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer id='top' defaultSize={props.topSlotDefaultSize || 0} slot='top' zIndex={props.topSlotZIndex} />
      <SplitPanel id='main-horizontal' flex={1}>
        <SlotRenderer
          slot='left'
          isTabbar={true}
          defaultSize={layout.left?.currentId ? layout.left?.size || 310 : 49}
          minResize={280}
          maxResize={480}
          minSize={49}
        />
        <SplitPanel id='main-vertical' minResize={300} flexGrow={1} direction='top-to-bottom'>
          <SlotRenderer flex={2} flexGrow={1} minResize={200} slot='main' />
          <SlotRenderer flex={1} defaultSize={layout.bottom?.size} minResize={160} slot='bottom' isTabbar={true} />
        </SplitPanel>
        <SlotRenderer
          slot='right'
          isTabbar={true}
          defaultSize={layout.right?.currentId ? layout.right?.size || 310 : 0}
          minResize={280}
          maxResize={480}
          minSize={0}
        />
      </SplitPanel>
      <SlotRenderer id='statusBar' defaultSize={24} slot='statusBar' />
    </BoxPanel>
  );
}
