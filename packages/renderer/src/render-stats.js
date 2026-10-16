// renderStats counts what shader programs draw, to show how much a frame
// costs: drawCalls, how many times something was drawn, and triangles, how
// many triangles that was. They count the frame being drawn, and last holds
// the counts of the last whole frame once startFrame starts the next one.
export const renderStats = {
  drawCalls: 0,
  triangles: 0,
  last: {drawCalls: 0, triangles: 0},

  startFrame() {
    this.last = {drawCalls: this.drawCalls, triangles: this.triangles};
    this.drawCalls = 0;
    this.triangles = 0;
  },
};
