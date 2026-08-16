/**
 * Hand the browser a file it did not fetch.
 *
 * The whole export path is client-side, which is not a shortcut around a missing
 * backend so much as the right shape for what it does: every figure in the file is
 * already on screen, so round-tripping to a server to have them read back would add
 * a way for the download and the page to disagree.
 */

/**
 * Byte-order mark, for Excel and nothing else.
 *
 * Without it Excel reads a UTF-8 CSV as the system codepage, and a placename with
 * an accent in it arrives mangled — on a file whose whole purpose is to be opened
 * in Excel. Written as an escape rather than the character itself, which is
 * invisible in a source file and reads as a stray backtick.
 */
const BOM = String.fromCharCode(0xfe_ff);

export const downloadText = (filename: string, text: string, mime: string): void => {
  const blob = new Blob([BOM + text], {type: `${mime};charset=utf-8`});
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};
