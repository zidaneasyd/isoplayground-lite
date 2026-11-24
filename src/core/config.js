export const CONFIG = {
  world: {
    width: 12,
    height: 12,
    baseElevation: 0
  },

  tile: {
    width: 64,
    height: 32,
    elevationStep: 16
  },

  colors: {
    background: "#141414",
    ground: "#383838",
    grid: "#4c4c4c",
    hover: "#8f7438",
    hoverOutline: "#f0d58a",
    selected: "#6f5a9e",
    selectedOutline: "#d7c4ff"
  },

  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    minZoom: 0.35,
    maxZoom: 3,
    wheelZoomSpeed: 0.001
  }
};
