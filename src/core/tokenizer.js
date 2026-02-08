function tokenize(code) {
  const tokens = [];
  const len = code.length;
  let i = 0;
  let line = 0;
  const openSymbols = [];

  while (i < len) {
    const c = code.charCodeAt(i);

    if (c === 10) {
      tokens.push({ type: 'NEWLINE', value: '\n', line });
      line++;
      i++;
      continue;
    }

    if (c === 32 || c === 9 || c === 13) {
      i++;
      continue;
    }

    if (c === 47) {
      const next = i + 1 < len ? code.charCodeAt(i + 1) : NaN;
      if (next === 47) {
        i += 2;
        while (i < len && code.charCodeAt(i) !== 10) {
          i++;
        }
        continue;
      }
      if (next === 42) {
        const startLine = line;
        i += 2;
        let foundEnd = false;
        while (i < len) {
          const ch = code.charCodeAt(i);
          if (ch === 42 && i + 1 < len && code.charCodeAt(i + 1) === 47) {
            i += 2;
            foundEnd = true;
            break;
          }
          if (ch === 10) {
            line++;
          }
          i++;
        }
        if (!foundEnd) {
          state.currentLine = startLine;
          error('Unterminated comment (expected */)');
        }
        continue;
      }
    }

    if (c === 34 || c === 39) {
      const quote = c;
      let str = '';
      const startLine = line;
      i++;
      let foundEnd = false;

      while (i < len) {
        const ch = code.charCodeAt(i);
        if (ch === quote) {
          foundEnd = true;
          break;
        }
        if (ch === 10) {
          state.currentLine = startLine;
          error('String cannot contain newlines. Use backticks (`) for multi-line strings');
        }
        if (ch === 92 && i + 1 < len) {
          i++;
          const esc = code.charCodeAt(i);
          if (esc === 110) str += '\n';
          else if (esc === 116) str += '\t';
          else if (esc === 114) str += '\r';
          else str += code[i];
        } else {
          str += code[i];
        }
        i++;
      }
      if (!foundEnd) {
        state.currentLine = startLine;
        error('Unterminated string (expected ' + String.fromCharCode(quote) + ')');
      }
      i++;
      tokens.push({ type: 'STRING', value: str, line: startLine });
      continue;
    }

    if (c === 96) {
      const parts = [];
      const expressions = [];
      let currentStr = '';
      const startLine = line;
      i++;
      let foundEnd = false;

      while (i < len) {
        const ch = code.charCodeAt(i);
        if (ch === 96) {
          foundEnd = true;
          break;
        }
        if (ch === 92 && i + 1 < len) {
          i++;
          const esc = code.charCodeAt(i);
          if (esc === 110) currentStr += '\n';
          else if (esc === 116) currentStr += '\t';
          else if (esc === 114) currentStr += '\r';
          else currentStr += code[i];
          i++;
        } else if (ch === 36 && i + 1 < len && code.charCodeAt(i + 1) === 123) {
          parts.push(currentStr);
          currentStr = '';
          i += 2;
          let expr = '';
          let braceCount = 1;
          const exprStartLine = line;

          while (i < len && braceCount > 0) {
            const ec = code.charCodeAt(i);
            if (ec === 123) braceCount++;
            else if (ec === 125) braceCount--;

            if (braceCount > 0) {
              expr += code[i];
            }
            if (ec === 10) line++;
            i++;
          }
          expressions.push({ code: expr, line: exprStartLine });
        } else {
          if (ch === 10) {
            currentStr += '\n';
            line++;
          } else {
            currentStr += code[i];
          }
          i++;
        }
      }

      if (!foundEnd) {
        state.currentLine = startLine;
        error('Unterminated template string (expected `)');
      }

      parts.push(currentStr);
      i++;

      if (expressions.length === 0) {
        tokens.push({ type: 'STRING', value: parts[0], line: startLine });
      } else {
        tokens.push({ type: 'TEMPLATE', parts: parts, expressions: expressions, line: startLine });
      }
      continue;
    }

    if (c >= 48 && c <= 57) {
      const start = i;
      const numLine = line;
      let isBigInt = false;
      let hasDecimal = false;

      if (c === 48 && i + 1 < len) {
        const next = code.charCodeAt(i + 1);
        if (next === 120 || next === 88) {
          i += 2;
          const hexStart = i;
          while (i < len) {
            const hc = code.charCodeAt(i);
            if (
              (hc >= 48 && hc <= 57) ||
              (hc >= 97 && hc <= 102) ||
              (hc >= 65 && hc <= 70) ||
              hc === 95
            ) {
              i++;
            } else {
              break;
            }
          }
          if (i < len && code.charCodeAt(i) === 110) {
            isBigInt = true;
            i++;
          }
          const raw = code.slice(hexStart, isBigInt ? i - 1 : i).replace(/_/g, '');
          tokens.push({
            type: 'NUMBER',
            value: isBigInt ? BigInt('0x' + raw) : parseInt(raw, 16),
            hasDecimal: false,
            isBigInt: isBigInt,
            line: numLine,
          });
          continue;
        }
        if (next === 111 || next === 79) {
          i += 2;
          const octStart = i;
          while (i < len) {
            const oc = code.charCodeAt(i);
            if ((oc >= 48 && oc <= 55) || oc === 95) {
              i++;
            } else {
              break;
            }
          }
          if (i < len && code.charCodeAt(i) === 110) {
            isBigInt = true;
            i++;
          }
          const raw = code.slice(octStart, isBigInt ? i - 1 : i).replace(/_/g, '');
          tokens.push({
            type: 'NUMBER',
            value: isBigInt ? BigInt('0o' + raw) : parseInt(raw, 8),
            hasDecimal: false,
            isBigInt: isBigInt,
            line: numLine,
          });
          continue;
        }
        if (next === 98 || next === 66) {
          i += 2;
          const binStart = i;
          while (i < len) {
            const bc = code.charCodeAt(i);
            if (bc === 48 || bc === 49 || bc === 95) {
              i++;
            } else {
              break;
            }
          }
          if (i < len && code.charCodeAt(i) === 110) {
            isBigInt = true;
            i++;
          }
          const raw = code.slice(binStart, isBigInt ? i - 1 : i).replace(/_/g, '');
          tokens.push({
            type: 'NUMBER',
            value: isBigInt ? BigInt('0b' + raw) : parseInt(raw, 2),
            hasDecimal: false,
            isBigInt: isBigInt,
            line: numLine,
          });
          continue;
        }
      }

      while (i < len) {
        const ch = code.charCodeAt(i);
        if (ch >= 48 && ch <= 57) {
          i++;
        } else if (ch === 95) {
          i++;
        } else if (ch === 46 && !hasDecimal) {
          hasDecimal = true;
          i++;
        } else if ((ch === 101 || ch === 69) && i + 1 < len) {
          i++;
          const nextCh = code.charCodeAt(i);
          if (nextCh === 43 || nextCh === 45) i++;
          while (i < len) {
            const ec = code.charCodeAt(i);
            if ((ec >= 48 && ec <= 57) || ec === 95) i++;
            else break;
          }
          hasDecimal = true;
          break;
        } else {
          break;
        }
      }

      if (i < len && code.charCodeAt(i) === 110 && !hasDecimal) {
        isBigInt = true;
        i++;
      }

      const rawStr = code.slice(start, i).replace(/_/g, '');
      let value;
      if (isBigInt) {
        value = BigInt(rawStr.slice(0, -1));
      } else {
        value = parseFloat(rawStr);
      }

      tokens.push({
        type: 'NUMBER',
        value: value,
        hasDecimal: hasDecimal,
        isBigInt: isBigInt,
        line: numLine,
      });
      continue;
    }

    if (c === 64) {
      const annotationLine = line;
      i++;
      const start = i;
      while (i < len) {
        const ch = code.charCodeAt(i);
        if (
          (ch >= 97 && ch <= 122) ||
          (ch >= 65 && ch <= 90) ||
          (ch >= 48 && ch <= 57) ||
          ch === 95
        ) {
          i++;
        } else {
          break;
        }
      }
      tokens.push({ type: 'ANNOTATION', value: code.slice(start, i), line: annotationLine });
      continue;
    }

    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95 || c >= 192) {
      if (
        c === 162 ||
        c === 163 ||
        c === 164 ||
        c === 165 ||
        c === 167 ||
        c === 172 ||
        c === 176 ||
        c === 177 ||
        c === 181 ||
        c === 182 ||
        c === 215 ||
        c === 247
      ) {
        state.currentLine = line;
        const hex = c.toString(16).toUpperCase().padStart(4, '0');
        error(`Unexpected character "${String.fromCharCode(c)}" (U+${hex})`);
      }

      const start = i;
      const wordLine = line;

      while (i < len) {
        const ch = code.charCodeAt(i);
        if (
          (ch >= 97 && ch <= 122) ||
          (ch >= 65 && ch <= 90) ||
          (ch >= 48 && ch <= 57) ||
          ch === 95 ||
          ch >= 192
        ) {
          i++;
        } else {
          break;
        }
      }

      const word = code.slice(start, i);
      if (state.keywords.has(word)) {
        tokens.push({ type: 'KEYWORD', value: word, line: wordLine });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: word, line: wordLine });
      }
      continue;
    }

    let op = '';
    if (c === 46) {
      if (i + 2 < len && code.charCodeAt(i + 1) === 46 && code.charCodeAt(i + 2) === 46) op = '...';
    } else if (c === 61) {
      if (i + 2 < len && code.charCodeAt(i + 1) === 61 && code.charCodeAt(i + 2) === 61) op = '===';
      else if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '==';
    } else if (c === 33) {
      if (i + 2 < len && code.charCodeAt(i + 1) === 61 && code.charCodeAt(i + 2) === 61) op = '!==';
      else if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '!=';
    } else if (c === 60) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '<=';
    } else if (c === 62) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '>=';
    } else if (c === 38) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 38) op = '&&';
    } else if (c === 124) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 124) op = '||';
    } else if (c === 43) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '+=';
      else if (i + 1 < len && code.charCodeAt(i + 1) === 43) op = '++';
    } else if (c === 45) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '-=';
      else if (i + 1 < len && code.charCodeAt(i + 1) === 45) op = '--';
    } else if (c === 42) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '*=';
    } else if (c === 47) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '/=';
    }

    if (op) {
      tokens.push({ type: 'OPERATOR', value: op, line });
      i += op.length;
      continue;
    }

    if (
      c === 40 ||
      c === 41 ||
      c === 123 ||
      c === 125 ||
      c === 91 ||
      c === 93 ||
      c === 44 ||
      c === 59 ||
      c === 46 ||
      c === 61 ||
      c === 43 ||
      c === 45 ||
      c === 42 ||
      c === 47 ||
      c === 37 ||
      c === 60 ||
      c === 62 ||
      c === 33 ||
      c === 38 ||
      c === 124 ||
      c === 58 ||
      c === 63
    ) {
      const char = code[i];
      if (c === 40 || c === 123 || c === 91) {
        openSymbols.push({ char: char, line: line });
      } else if (c === 41 || c === 125 || c === 93) {
        const expected = c === 41 ? '(' : c === 125 ? '{' : '[';
        if (openSymbols.length > 0 && openSymbols[openSymbols.length - 1].char === expected) {
          openSymbols.pop();
        }
      }
      tokens.push({ type: 'SYMBOL', value: char, line });
      i++;
      continue;
    }

    state.currentLine = line;
    error(
      'Unexpected character "' +
        code[i] +
        '" (Unicode: U+' +
        c.toString(16).toUpperCase().padStart(4, '0') +
        ')'
    );
  }

  if (openSymbols.length > 0) {
    const lastOpen = openSymbols[openSymbols.length - 1];
    const closeChar = lastOpen.char === '(' ? ')' : lastOpen.char === '{' ? '}' : ']';
    state.currentLine = lastOpen.line;
    error('Expected SYMBOL "' + closeChar + '" but got EOF');
  }

  return tokens;
}
