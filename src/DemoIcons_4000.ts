import { startIconDemo } from "./demos/IconDemoWorld";

const SOCIAL_ICONS = [61_570, 61_594, 61_575, 61_796, 61_444, 61_488, 61_755];

startIconDemo({
  words: ["ICS", "4000"],
  fontSize: 32,
  backgroundDistance: 10_000,
  iconSource: SOCIAL_ICONS,
  // 対角移動を使わず、ドリーズーム30% / 俯瞰70%で切り替える。
  cameraWeights: [0.3, 0.7],
  // 極低速を使わず、強いリマップ60% / 等速40%で切り替える。
  timeRemapWeights: [0.6, 0, 0.4],
  advanceHue: false,
});
