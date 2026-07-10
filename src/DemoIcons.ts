import { startIconDemo } from "./demos/IconDemoWorld";

startIconDemo({
  words: ["WebGPU", "THREE"],
  fontSize: 42,
  backgroundDistance: 25_000,
  iconSource: 61_730,
  // ドリーズーム・俯瞰・対角を30% / 35% / 35%で切り替える。
  cameraWeights: [0.3, 0.35, 0.35],
  // 強いリマップ・極低速・等速を30% / 35% / 35%で切り替える。
  timeRemapWeights: [0.3, 0.35, 0.35],
  advanceHue: true,
});
