/*
 * qr-core.js — Self-contained ISO/IEC 18004 (QR Code Model 2) encoder,
 * URL normalizer, contrast checker, and Canvas/SVG renderers.
 * Zero external dependencies. Works in browser (window.QRCore) and Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.QRCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Error Correction Levels (ISO/IEC 18004)
  // ordinal: index into tables; formatBits: 2-bit format indicator
  const ECL = {
    L: { name: 'L', ordinal: 0, formatBits: 1 },
    M: { name: 'M', ordinal: 1, formatBits: 0 },
    Q: { name: 'Q', ordinal: 2, formatBits: 3 },
    H: { name: 'H', ordinal: 3, formatBits: 2 },
  };

  // Index 0 is unused padding so versions 1..40 align directly with array indices.
  const ECC_CODEWORDS_PER_BLOCK = [
    // L
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    // M
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    // Q
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    // H
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  ];

  const NUM_ERROR_CORRECTION_BLOCKS = [
    // L
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    // M
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    // Q
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    // H
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  ];

  const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  const NUMERIC_REGEX = /^[0-9]*$/;
  const ALPHANUMERIC_REGEX = /^[0-9A-Z $%*+\-./:]*$/;

  const MODE = {
    NUMERIC: { modeBits: 0x1, numBitsCharCount: [10, 12, 14] },
    ALPHANUMERIC: { modeBits: 0x2, numBitsCharCount: [9, 11, 13] },
    BYTE: { modeBits: 0x4, numBitsCharCount: [8, 16, 16] },
  };

  function charCountBits(mode, ver) {
    return mode.numBitsCharCount[Math.floor((ver + 7) / 17)];
  }

  function appendBits(val, len, bb) {
    for (let i = len - 1; i >= 0; i--) {
      bb.push((val >>> i) & 1);
    }
  }

  function toUtf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(str));
    }
    const bytes = [];
    const encoded = encodeURIComponent(str);
    for (let i = 0; i < encoded.length; i++) {
      if (encoded[i] === '%') {
        bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(encoded.charCodeAt(i));
      }
    }
    return bytes;
  }

  function makeSegment(text) {
    if (text === '') {
      return { mode: MODE.BYTE, numChars: 0, bitData: [] };
    }
    if (NUMERIC_REGEX.test(text)) {
      const bb = [];
      for (let i = 0; i < text.length; ) {
        const n = Math.min(text.length - i, 3);
        appendBits(parseInt(text.slice(i, i + n), 10), n * 3 + 1, bb);
        i += n;
      }
      return { mode: MODE.NUMERIC, numChars: text.length, bitData: bb };
    }
    if (ALPHANUMERIC_REGEX.test(text)) {
      const bb = [];
      let i;
      for (i = 0; i + 2 <= text.length; i += 2) {
        const temp =
          ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45 +
          ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
        appendBits(temp, 11, bb);
      }
      if (i < text.length) {
        appendBits(ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
      }
      return { mode: MODE.ALPHANUMERIC, numChars: text.length, bitData: bb };
    }
    const bytes = toUtf8Bytes(text);
    const bb = [];
    for (let i = 0; i < bytes.length; i++) {
      appendBits(bytes[i], 8, bb);
    }
    return { mode: MODE.BYTE, numChars: bytes.length, bitData: bb };
  }

  function getNumRawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) {
        result -= 36;
      }
    }
    return result;
  }

  function getNumDataCodewords(ver, ecl) {
    return (
      Math.floor(getNumRawDataModules(ver) / 8) -
      ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] *
        NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver]
    );
  }

  function getAlignmentPatternPositions(ver) {
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step =
      ver === 32
        ? 26
        : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) {
      result.splice(1, 0, pos);
    }
    return result;
  }

  // Reed-Solomon over GF(2^8) with primitive polynomial 0x11D
  function rsMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsComputeDivisor(degree) {
    const result = new Uint8Array(degree);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = rsMultiply(result[j], root);
        if (j + 1 < result.length) {
          result[j] ^= result[j + 1];
        }
      }
      root = rsMultiply(root, 0x02);
    }
    return result;
  }

  function rsComputeRemainder(data, divisor) {
    const result = new Uint8Array(divisor.length);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ result[0];
      result.copyWithin(0, 1);
      result[result.length - 1] = 0;
      for (let j = 0; j < divisor.length; j++) {
        result[j] ^= rsMultiply(divisor[j], factor);
      }
    }
    return result;
  }

  function addEccAndInterleave(data, ver, ecl) {
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
    const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    const blocks = [];
    const rsDiv = rsComputeDivisor(blockEccLen);
    let k = 0;
    for (let i = 0; i < numBlocks; i++) {
      const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
      const dat = data.slice(k, k + datLen);
      k += datLen;
      const ecc = rsComputeRemainder(dat, rsDiv);
      const block = new Uint8Array(shortBlockLen + 1);
      block.set(dat, 0);
      if (i < numShortBlocks) {
        block[datLen] = 0;
        block.set(ecc, datLen + 1);
      } else {
        block.set(ecc, datLen);
      }
      blocks.push({ datLen, block });
    }

    const result = [];
    for (let i = 0; i < shortBlockLen + 1; i++) {
      for (let j = 0; j < blocks.length; j++) {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
          result.push(blocks[j].block[i]);
        }
      }
    }
    return result;
  }

  function encodeText(text, eclName) {
    const ecl = ECL[eclName] || ECL.M;
    const seg = makeSegment(text);

    // Choose smallest version that fits
    let version = -1;
    let dataUsedBits = 0;
    for (let v = 1; v <= 40; v++) {
      const ccBits = charCountBits(seg.mode, v);
      if (seg.numChars >= (1 << ccBits)) continue;
      const totalBits = 4 + ccBits + seg.bitData.length;
      if (totalBits <= getNumDataCodewords(v, ecl) * 8) {
        version = v;
        dataUsedBits = totalBits;
        break;
      }
    }
    if (version === -1) {
      throw new RangeError('Input is too long to fit in a QR code.');
    }

    const bb = [];
    appendBits(seg.mode.modeBits, 4, bb);
    appendBits(seg.numChars, charCountBits(seg.mode, version), bb);
    for (let i = 0; i < seg.bitData.length; i++) {
      bb.push(seg.bitData[i]);
    }

    const dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
    appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
    appendBits(0, (8 - (bb.length % 8)) % 8, bb);

    for (let padByte = 0xec; bb.length < dataCapacityBits; padByte ^= 0xec ^ 0x11) {
      appendBits(padByte, 8, bb);
    }

    const dataCodewords = new Uint8Array(bb.length / 8);
    for (let i = 0; i < bb.length; i++) {
      dataCodewords[i >>> 3] |= bb[i] << (7 - (i & 7));
    }

    const allCodewords = addEccAndInterleave(dataCodewords, version, ecl);
    return buildMatrix(version, ecl, allCodewords);
  }

  function buildMatrix(version, ecl, allCodewords) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

    function setFunctionModule(x, y, isDark) {
      modules[y][x] = isDark;
      isFunction[y][x] = true;
    }

    function drawFinderPattern(cx, cy) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const xx = cx + dx;
          const yy = cy + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) {
            setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
          }
        }
      }
    }

    function drawAlignmentPattern(cx, cy) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunctionModule(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }

    function drawFormatBits(mask) {
      const data = (ecl.formatBits << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i++) {
        rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      }
      const bits = ((data << 10) | rem) ^ 0x5412;

      for (let i = 0; i <= 5; i++) setFunctionModule(8, i, ((bits >>> i) & 1) !== 0);
      setFunctionModule(8, 7, ((bits >>> 6) & 1) !== 0);
      setFunctionModule(8, 8, ((bits >>> 7) & 1) !== 0);
      setFunctionModule(7, 8, ((bits >>> 8) & 1) !== 0);
      for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, ((bits >>> i) & 1) !== 0);

      for (let i = 0; i < 8; i++) setFunctionModule(size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
      for (let i = 8; i < 15; i++) setFunctionModule(8, size - 15 + i, ((bits >>> i) & 1) !== 0);
      setFunctionModule(8, size - 8, true);
    }

    function drawVersion() {
      if (version < 7) return;
      let rem = version;
      for (let i = 0; i < 12; i++) {
        rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      }
      const bits = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const color = ((bits >>> i) & 1) !== 0;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunctionModule(a, b, color);
        setFunctionModule(b, a, color);
      }
    }

    // 1. Timing patterns
    for (let i = 0; i < size; i++) {
      setFunctionModule(6, i, i % 2 === 0);
      setFunctionModule(i, 6, i % 2 === 0);
    }

    // 2. Finder patterns
    drawFinderPattern(3, 3);
    drawFinderPattern(size - 4, 3);
    drawFinderPattern(3, size - 4);

    // 3. Alignment patterns
    const alignPos = getAlignmentPatternPositions(version);
    const numAlign = alignPos.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        if (
          !(i === 0 && j === 0) &&
          !(i === 0 && j === numAlign - 1) &&
          !(i === numAlign - 1 && j === 0)
        ) {
          drawAlignmentPattern(alignPos[i], alignPos[j]);
        }
      }
    }

    // 4. Reserve format & version areas
    drawFormatBits(0);
    drawVersion();

    // 5. Place data + ECC bits in 2-column zigzag
    let bitIndex = 0;
    const totalBits = allCodewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x] && bitIndex < totalBits) {
            modules[y][x] =
              ((allCodewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
            bitIndex++;
          }
        }
      }
    }

    // 6. Apply mask and evaluate ISO/IEC 18004 penalty score
    function applyMask(mask) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (isFunction[y][x]) continue;
          let invert = false;
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
            case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          }
          if (invert) modules[y][x] = !modules[y][x];
        }
      }
    }

    function finderPenaltyCountPatterns(runHistory) {
      const n = runHistory[1];
      const core =
        n > 0 &&
        runHistory[2] === n &&
        runHistory[3] === n * 3 &&
        runHistory[4] === n &&
        runHistory[5] === n;
      return (
        (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) +
        (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0)
      );
    }

    function finderPenaltyAddHistory(currentRunLength, runHistory) {
      if (runHistory[0] === 0) currentRunLength += size;
      runHistory.pop();
      runHistory.unshift(currentRunLength);
    }

    function finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
      if (currentRunColor) {
        finderPenaltyAddHistory(currentRunLength, runHistory);
        currentRunLength = 0;
      }
      currentRunLength += size;
      finderPenaltyAddHistory(currentRunLength, runHistory);
      return finderPenaltyCountPatterns(runHistory);
    }

    function getPenaltyScore() {
      let result = 0;

      // Rule 1 & Rule 3 (rows)
      for (let y = 0; y < size; y++) {
        let runColor = false;
        let runX = 0;
        const runHistory = [0, 0, 0, 0, 0, 0, 0];
        for (let x = 0; x < size; x++) {
          if (modules[y][x] === runColor) {
            runX++;
            if (runX === 5) result += 3;
            else if (runX > 5) result++;
          } else {
            finderPenaltyAddHistory(runX, runHistory);
            if (!runColor) result += finderPenaltyCountPatterns(runHistory) * 40;
            runColor = modules[y][x];
            runX = 1;
          }
        }
        result += finderPenaltyTerminateAndCount(runColor, runX, runHistory) * 40;
      }

      // Rule 1 & Rule 3 (columns)
      for (let x = 0; x < size; x++) {
        let runColor = false;
        let runY = 0;
        const runHistory = [0, 0, 0, 0, 0, 0, 0];
        for (let y = 0; y < size; y++) {
          if (modules[y][x] === runColor) {
            runY++;
            if (runY === 5) result += 3;
            else if (runY > 5) result++;
          } else {
            finderPenaltyAddHistory(runY, runHistory);
            if (!runColor) result += finderPenaltyCountPatterns(runHistory) * 40;
            runColor = modules[y][x];
            runY = 1;
          }
        }
        result += finderPenaltyTerminateAndCount(runColor, runY, runHistory) * 40;
      }

      // Rule 2: 2x2 blocks of same color
      for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
          const color = modules[y][x];
          if (
            color === modules[y][x + 1] &&
            color === modules[y + 1][x] &&
            color === modules[y + 1][x + 1]
          ) {
            result += 3;
          }
        }
      }

      // Rule 4: dark/light balance
      let dark = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (modules[y][x]) dark++;
        }
      }
      const total = size * size;
      const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      result += k * 10;
      return result;
    }

    let bestMask = 0;
    let minPenalty = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m);
      drawFormatBits(m);
      const penalty = getPenaltyScore();
      if (penalty < minPenalty) {
        bestMask = m;
        minPenalty = penalty;
      }
      applyMask(m); // XOR back
    }

    applyMask(bestMask);
    drawFormatBits(bestMask);

    return {
      version,
      size,
      ecl: ecl.name,
      mask: bestMask,
      modules,
      getModule(x, y) {
        return x >= 0 && x < size && y >= 0 && y < size && modules[y][x];
      },
    };
  }

  // URL normalization: automatically prepend https:// when no URI scheme is present
  function normalizeUrl(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      return { value: '', prepended: false };
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      return { value: trimmed, prepended: false };
    }
    const stripped = trimmed.replace(/^\/+/, '');
    return { value: 'https://' + stripped, prepended: true };
  }

  // Build a friendly filename from a URL, e.g. qr-michaelteter-com.png
  function buildFilename(url, ext) {
    let slug = 'code';
    try {
      const parsed = new URL(url);
      const hostPart = (parsed.hostname || '').replace(/^www\./, '');
      const pathPart = (parsed.pathname || '').replace(/^\/+|\/+$/g, '');
      const combined = pathPart ? hostPart + '-' + pathPart : hostPart;
      slug = combined
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    } catch {
      slug = String(url || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    }
    return 'qr-' + (slug || 'code') + '.' + ext;
  }

  // Contrast utilities for scan reliability feedback
  function parseHexColor(hex) {
    const clean = String(hex || '').replace(/^#/, '').trim();
    if (/^[0-9a-fA-F]{3}$/.test(clean)) {
      return {
        r: parseInt(clean[0] + clean[0], 16),
        g: parseInt(clean[1] + clean[1], 16),
        b: parseInt(clean[2] + clean[2], 16),
      };
    }
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16),
      };
    }
    return { r: 0, g: 0, b: 0 };
  }

  function relativeLuminance(hex) {
    const { r, g, b } = parseHexColor(hex);
    const toLinear = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  function checkContrast(fgHex, bgHex) {
    const lumFg = relativeLuminance(fgHex);
    const lumBg = relativeLuminance(bgHex);
    const lighter = Math.max(lumFg, lumBg);
    const darker = Math.min(lumFg, lumBg);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    return {
      ratio,
      isInverted: lumFg > lumBg,
      isLowContrast: ratio < 3.5,
    };
  }

  function isInFinder(x, y, size) {
    return (
      (x < 7 && y < 7) ||
      (x >= size - 7 && y < 7) ||
      (x < 7 && y >= size - 7)
    );
  }

  function roundedRectPath(ctx, x, y, w, h, radii) {
    const [tl, tr, br, bl] = Array.isArray(radii)
      ? radii
      : [radii, radii, radii, radii];
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br);
    if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);
    if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl);
    if (tl) ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
  }

  function drawModernFinderCanvas(ctx, x, y, cell, fg, bg, isDots) {
    const outerR = isDots ? cell * 2.1 : cell * 1.65;
    const innerCutR = isDots ? cell * 1.35 : cell * 1.05;
    const eyeR = isDots ? cell * 1.15 : cell * 0.85;

    ctx.fillStyle = fg;
    roundedRectPath(ctx, x, y, cell * 7, cell * 7, outerR);
    ctx.fill();

    ctx.fillStyle = bg;
    roundedRectPath(ctx, x + cell, y + cell, cell * 5, cell * 5, innerCutR);
    ctx.fill();

    ctx.fillStyle = fg;
    roundedRectPath(ctx, x + cell * 2, y + cell * 2, cell * 3, cell * 3, eyeR);
    ctx.fill();
  }

  function renderToCanvas(canvas, qr, opts) {
    const sizePx = opts.size || 1024;
    const style = opts.style || 'rounded';
    const fg = opts.fg || '#000000';
    const bg = opts.bg || '#ffffff';
    const quietZone = 4;

    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, sizePx, sizePx);

    const totalModules = qr.size + quietZone * 2;
    const cell = Math.floor(sizePx / totalModules);
    const gridPx = qr.size * cell;
    const offset = Math.floor((sizePx - gridPx) / 2);

    if (style === 'classic') {
      ctx.fillStyle = fg;
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (qr.getModule(x, y)) {
            ctx.fillRect(offset + x * cell, offset + y * cell, cell, cell);
          }
        }
      }
      return;
    }

    // Modern Rounded & Dots styles: crisp rounded finder eyes first
    const isDots = style === 'dots';
    drawModernFinderCanvas(ctx, offset, offset, cell, fg, bg, isDots);
    drawModernFinderCanvas(
      ctx,
      offset + (qr.size - 7) * cell,
      offset,
      cell,
      fg,
      bg,
      isDots
    );
    drawModernFinderCanvas(
      ctx,
      offset,
      offset + (qr.size - 7) * cell,
      cell,
      fg,
      bg,
      isDots
    );

    ctx.fillStyle = fg;

    if (isDots) {
      const r = cell * 0.44;
      const half = cell / 2;
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (isInFinder(x, y, qr.size) || !qr.getModule(x, y)) continue;
          ctx.beginPath();
          ctx.arc(offset + x * cell + half, offset + y * cell + half, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }

    // Modern Rounded: connect adjacent orthogonal neighbors seamlessly, round outer corners
    const cornerR = cell * 0.42;
    const isDataDark = (x, y) => !isInFinder(x, y, qr.size) && qr.getModule(x, y);

    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (!isDataDark(x, y)) continue;
        const n = isDataDark(x, y - 1);
        const s = isDataDark(x, y + 1);
        const w = isDataDark(x - 1, y);
        const e = isDataDark(x + 1, y);
        const radii = [
          !n && !w ? cornerR : 0,
          !n && !e ? cornerR : 0,
          !s && !e ? cornerR : 0,
          !s && !w ? cornerR : 0,
        ];
        roundedRectPath(
          ctx,
          offset + x * cell,
          offset + y * cell,
          cell,
          cell,
          radii
        );
        ctx.fill();
      }
    }
  }

  function svgRoundedRect(x, y, w, h, radii) {
    const [tl, tr, br, bl] = radii;
    if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
      return `M${x} ${y}h${w}v${h}h${-w}Z`;
    }
    return [
      `M${x + tl} ${y}`,
      `h${w - tl - tr}`,
      tr ? `a${tr} ${tr} 0 0 1 ${tr} ${tr}` : '',
      `v${h - tr - br}`,
      br ? `a${br} ${br} 0 0 1 ${-br} ${br}` : '',
      `h${-(w - br - bl)}`,
      bl ? `a${bl} ${bl} 0 0 1 ${-bl} ${-bl}` : '',
      `v${-(h - bl - tl)}`,
      tl ? `a${tl} ${tl} 0 0 1 ${tl} ${-tl}` : '',
      'Z',
    ].join('');
  }

  function renderToSvg(qr, opts) {
    const sizePx = opts.size || 1024;
    const style = opts.style || 'rounded';
    const fg = opts.fg || '#000000';
    const bg = opts.bg || '#ffffff';
    const quietZone = 4;
    const vb = qr.size + quietZone * 2;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="${sizePx}" height="${sizePx}" shape-rendering="${style === 'classic' ? 'crispEdges' : 'geometricPrecision'}">`,
      `<rect width="${vb}" height="${vb}" fill="${bg}"/>`,
    ];

    if (style === 'classic') {
      let d = '';
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (qr.getModule(x, y)) {
            d += `M${x + quietZone} ${y + quietZone}h1v1h-1Z`;
          }
        }
      }
      parts.push(`<path d="${d}" fill="${fg}"/>`);
      parts.push('</svg>');
      return parts.join('');
    }

    const isDots = style === 'dots';
    const outerR = isDots ? 2.1 : 1.65;
    const innerCutR = isDots ? 1.35 : 1.05;
    const eyeR = isDots ? 1.15 : 0.85;

    const finders = [
      [quietZone, quietZone],
      [quietZone + qr.size - 7, quietZone],
      [quietZone, quietZone + qr.size - 7],
    ];
    for (const [fx, fy] of finders) {
      parts.push(`<rect x="${fx}" y="${fy}" width="7" height="7" rx="${outerR}" fill="${fg}"/>`);
      parts.push(`<rect x="${fx + 1}" y="${fy + 1}" width="5" height="5" rx="${innerCutR}" fill="${bg}"/>`);
      parts.push(`<rect x="${fx + 2}" y="${fy + 2}" width="3" height="3" rx="${eyeR}" fill="${fg}"/>`);
    }

    if (isDots) {
      const circles = [];
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (isInFinder(x, y, qr.size) || !qr.getModule(x, y)) continue;
          circles.push(
            `<circle cx="${x + quietZone + 0.5}" cy="${y + quietZone + 0.5}" r="0.44"/>`
          );
        }
      }
      parts.push(`<g fill="${fg}">${circles.join('')}</g>`);
    } else {
      const r = 0.42;
      const isDataDark = (x, y) => !isInFinder(x, y, qr.size) && qr.getModule(x, y);
      let d = '';
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (!isDataDark(x, y)) continue;
          const n = isDataDark(x, y - 1);
          const s = isDataDark(x, y + 1);
          const w = isDataDark(x - 1, y);
          const e = isDataDark(x + 1, y);
          d += svgRoundedRect(x + quietZone, y + quietZone, 1, 1, [
            !n && !w ? r : 0,
            !n && !e ? r : 0,
            !s && !e ? r : 0,
            !s && !w ? r : 0,
          ]);
        }
      }
      parts.push(`<path d="${d}" fill="${fg}"/>`);
    }

    parts.push('</svg>');
    return parts.join('');
  }

  return {
    ECL,
    encodeText,
    normalizeUrl,
    buildFilename,
    checkContrast,
    renderToCanvas,
    renderToSvg,
  };
});
