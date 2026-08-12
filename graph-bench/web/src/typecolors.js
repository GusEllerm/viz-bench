// Shared node-type palette for the graph pages — ONE source of truth so every engine colours
// identically. Keys are the ogbn-arxiv subject areas (the `t` field the prep pipeline emits);
// the ten largest categories get distinct hues, everything else falls back to grey. Exposed in
// each format the engines want (hex / rgb 0–255 / rgb 0–1 / rgba 0–1).
export const TYPE_HEX = {
  'cs.CV': '#4C78A8', // computer vision (27K nodes)
  'cs.LG': '#F58518', // machine learning (22K)
  'cs.IT': '#54A24B', // information theory (21K)
  'cs.CL': '#E45756', // computation & language (12K)
  'cs.AI': '#72B7B2', // artificial intelligence
  'cs.DS': '#EECA3B', // data structures & algorithms
  'cs.NI': '#B279A2', // networking
  'cs.CR': '#FF9DA6', // security & cryptography
  'cs.DC': '#9C755F', // distributed computing
  'cs.LO': '#A0CBE8', // logic
};
const FALLBACK_HEX = '#9aa0aa';

const rgb255 = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

export const hexOf = (t) => TYPE_HEX[t] || FALLBACK_HEX;
export const rgb255Of = (t) => rgb255(hexOf(t));
export const rgb01Of = (t) => rgb255(hexOf(t)).map((v) => +(v / 255).toFixed(3));
export const rgba01Of = (t) => [...rgb01Of(t), 1.0];
