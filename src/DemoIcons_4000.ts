import { startIconDemo } from "./demos/IconDemoWorld";

startIconDemo({
  words: ["ICS", "4000"],
  fontSize: 32,
  backgroundDistance: 10_000,
  // 対角移動を使わず、ドリーズーム30% / 俯瞰70%で切り替える。
  cameraWeights: [0.3, 0.7],
  // 極低速を使わず、強いリマップ60% / 等速40%で切り替える。
  timeRemapWeights: [0.6, 0, 0.4],
  advanceHue: false,
});
