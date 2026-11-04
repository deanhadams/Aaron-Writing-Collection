/** A place in the Word file. Fixed once written, wherever the row moves on the site. */
export const episodeImportKey = (episodeNumber: number) => `e${episodeNumber}`;

export const sceneImportKey = (episodeNumber: number, position: number) =>
  `${episodeImportKey(episodeNumber)}:s${position}`;
