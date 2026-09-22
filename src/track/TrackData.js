/**
 * Data-driven track definitions. Each `points` array is a closed loop of
 * [x, y, z] control points (meters) fed into a Catmull-Rom spline by
 * TrackBuilder. Elevation differences between points create hills/dips
 * automatically because the spline interpolates height smoothly.
 */
export const TRACKS = [
  {
    id: 'sunset-hills',
    name: 'Zonsondergang Heuvels',
    description: 'Glooiende heuvels, brede bochten en een duizelingwekkend hoogteverschil.',
    theme: 'sunset',
    width: 16,
    laps: 3,
    checkpoints: [0.18, 0.36, 0.54, 0.72, 0.88],
    points: [
      [204.3, 5.6, 0],
      [146.4, 4.8, 47.6],
      [95.9, 3.5, 69.6],
      [62.8, 2.2, 86.4],
      [35, 1.5, 107.7],
      [0, 1.5, 125.8],
      [-42, 1.9, 129.3],
      [-83.7, 2.2, 115.3],
      [-119.3, 1.9, 86.7],
      [-142.9, 0.6, 46.4],
      [-145.6, -1.6, 0],
      [-122.5, -4.1, -39.8],
      [-83.9, -6.4, -60.9],
      [-49.7, -7.7, -68.4],
      [-27.4, -7.4, -84.4],
      [0, -5.5, -124.3],
      [56, -2.5, -172.4],
      [138.3, 0.8, -190.4],
      [211.3, 3.6, -153.5],
      [235.6, 5.3, -76.5],
    ],
  },
  {
    id: 'neon-nights',
    name: 'Neon Nachten',
    description: 'Een strak stadscircuit vol scherpe hoeken, gloeiende reclames en natte straten.',
    theme: 'night',
    width: 13,
    laps: 3,
    checkpoints: [0.2, 0.4, 0.6, 0.8],
    points: [
      [119.1, 2.4, 0],
      [98.9, 3.5, 36],
      [81.3, 2.8, 68.2],
      [62.2, 1, 107.7],
      [24.7, -0.5, 140],
      [-24.6, -0.5, 139.4],
      [-62.3, 0.3, 107.9],
      [-80.8, 0.5, 67.8],
      [-84.8, -0.6, 30.9],
      [-76, -2.4, 0],
      [-63.6, -3.5, -23.1],
      [-60.3, -2.8, -50.6],
      [-55.2, -1, -95.5],
      [-24.9, 0.5, -141.1],
      [27.4, 0.5, -155.3],
      [76.8, -0.3, -133.1],
      [110.4, -0.5, -92.6],
      [125.7, 0.6, -45.7],
    ],
  },
];

export function getTrackById(id) {
  return TRACKS.find((t) => t.id === id) || TRACKS[0];
}
