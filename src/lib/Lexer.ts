/**
 * LexicalParser - TypeScript JSON Stream Parser
 * 
 * A lexical analyzer for streaming JSON that can handle incomplete JSON structures
 * and automatically complete them using a mirror token stack approach.
 * 
 * Compatible with the timeline system used by JSONStreamParser, providing:
 * - processToken(token: string): Process streaming tokens
 * - getCompletedSections(): Get parsed sections for timeline
 * - resetAll(): Reset parser state
 * 
 * Unlike JSONStreamParser which parses structured sections, LexicalParser
 * focuses on completing valid JSON from incomplete streams.
 * 
 * Usage:
 * const parser = new Lexer(allowedSections, skipNonValidSections);
 * parser.processToken(token);
 * const sections = parser.getCompletedSections();
 * Property of Okiynai
 */

// Token constants
const TOKEN_EOF = 0 as const; // end-of-file
const TOKEN_IGNORED = 1 as const; // \t', '\n', '\v', '\f', '\r', ' '
const TOKEN_LEFT_BRACKET = 2 as const; // [
const TOKEN_RIGHT_BRACKET = 3 as const; // ]
const TOKEN_LEFT_BRACE = 4 as const; // {
const TOKEN_RIGHT_BRACE = 5 as const; // }
const TOKEN_COLON = 6 as const; // :
const TOKEN_DOT = 7 as const; // .
const TOKEN_COMMA = 8 as const; // ,
const TOKEN_QUOTE = 9 as const; // "
const TOKEN_ESCAPE_CHARACTER = 10 as const; // \
const TOKEN_SLASH = 11 as const; // /
const TOKEN_NEGATIVE = 12 as const; // -
const TOKEN_NULL = 13 as const; // null
const TOKEN_TRUE = 14 as const; // true
const TOKEN_FALSE = 15 as const; // false
const TOKEN_ALPHABET_LOWERCASE_A = 16 as const; // a
const TOKEN_ALPHABET_LOWERCASE_B = 17 as const; // b
const TOKEN_ALPHABET_LOWERCASE_C = 18 as const; // c
const TOKEN_ALPHABET_LOWERCASE_D = 19 as const; // d
const TOKEN_ALPHABET_LOWERCASE_E = 20 as const; // e
const TOKEN_ALPHABET_LOWERCASE_F = 21 as const; // f
const TOKEN_ALPHABET_LOWERCASE_L = 22 as const; // l
const TOKEN_ALPHABET_LOWERCASE_N = 23 as const; // n
const TOKEN_ALPHABET_LOWERCASE_R = 24 as const; // r
const TOKEN_ALPHABET_LOWERCASE_S = 25 as const; // s
const TOKEN_ALPHABET_LOWERCASE_T = 26 as const; // t
const TOKEN_ALPHABET_LOWERCASE_U = 27 as const; // u
const TOKEN_ALPHABET_UPPERCASE_A = 28 as const; // A
const TOKEN_ALPHABET_UPPERCASE_B = 29 as const; // B
const TOKEN_ALPHABET_UPPERCASE_C = 30 as const; // C
const TOKEN_ALPHABET_UPPERCASE_D = 31 as const; // D
const TOKEN_ALPHABET_UPPERCASE_E = 32 as const; // E
const TOKEN_ALPHABET_UPPERCASE_F = 33 as const; // F
const TOKEN_NUMBER = 34 as const; // number
const TOKEN_NUMBER_0 = 35 as const; // 0
const TOKEN_NUMBER_1 = 36 as const; // 1
const TOKEN_NUMBER_2 = 37 as const; // 2
const TOKEN_NUMBER_3 = 38 as const; // 3
const TOKEN_NUMBER_4 = 39 as const; // 4
const TOKEN_NUMBER_5 = 40 as const; // 5
const TOKEN_NUMBER_6 = 41 as const; // 6
const TOKEN_NUMBER_7 = 42 as const; // 7
const TOKEN_NUMBER_8 = 43 as const; // 8
const TOKEN_NUMBER_9 = 44 as const; // 9
const TOKEN_OTHERS = 45 as const; // anything else in json

type Token = typeof TOKEN_EOF | typeof TOKEN_IGNORED | typeof TOKEN_LEFT_BRACKET |
  typeof TOKEN_RIGHT_BRACKET | typeof TOKEN_LEFT_BRACE | typeof TOKEN_RIGHT_BRACE |
  typeof TOKEN_COLON | typeof TOKEN_DOT | typeof TOKEN_COMMA | typeof TOKEN_QUOTE |
  typeof TOKEN_ESCAPE_CHARACTER | typeof TOKEN_SLASH | typeof TOKEN_NEGATIVE |
  typeof TOKEN_NULL | typeof TOKEN_TRUE | typeof TOKEN_FALSE |
  typeof TOKEN_ALPHABET_LOWERCASE_A | typeof TOKEN_ALPHABET_LOWERCASE_B |
  typeof TOKEN_ALPHABET_LOWERCASE_C | typeof TOKEN_ALPHABET_LOWERCASE_D |
  typeof TOKEN_ALPHABET_LOWERCASE_E | typeof TOKEN_ALPHABET_LOWERCASE_F |
  typeof TOKEN_ALPHABET_LOWERCASE_L | typeof TOKEN_ALPHABET_LOWERCASE_N |
  typeof TOKEN_ALPHABET_LOWERCASE_R | typeof TOKEN_ALPHABET_LOWERCASE_S |
  typeof TOKEN_ALPHABET_LOWERCASE_T | typeof TOKEN_ALPHABET_LOWERCASE_U |
  typeof TOKEN_ALPHABET_UPPERCASE_A | typeof TOKEN_ALPHABET_UPPERCASE_B |
  typeof TOKEN_ALPHABET_UPPERCASE_C | typeof TOKEN_ALPHABET_UPPERCASE_D |
  typeof TOKEN_ALPHABET_UPPERCASE_E | typeof TOKEN_ALPHABET_UPPERCASE_F |
  typeof TOKEN_NUMBER | typeof TOKEN_NUMBER_0 | typeof TOKEN_NUMBER_1 |
  typeof TOKEN_NUMBER_2 | typeof TOKEN_NUMBER_3 | typeof TOKEN_NUMBER_4 |
  typeof TOKEN_NUMBER_5 | typeof TOKEN_NUMBER_6 | typeof TOKEN_NUMBER_7 |
  typeof TOKEN_NUMBER_8 | typeof TOKEN_NUMBER_9 | typeof TOKEN_OTHERS;

// token symbol const
const TOKEN_EOF_SYMBOL = 'EOF';
const TOKEN_LEFT_BRACKET_SYMBOL = '[';
const TOKEN_RIGHT_BRACKET_SYMBOL = ']';
const TOKEN_LEFT_BRACE_SYMBOL = '{';
const TOKEN_RIGHT_BRACE_SYMBOL = '}';
const TOKEN_COLON_SYMBOL = ':';
const TOKEN_DOT_SYMBOL = '.';
const TOKEN_COMMA_SYMBOL = ',';
const TOKEN_QUOTE_SYMBOL = '"';
const TOKEN_ESCAPE_CHARACTER_SYMBOL = '\\';
const TOKEN_SLASH_SYMBOL = '/';
const TOKEN_NEGATIVE_SYMBOL = '-';
const TOKEN_NULL_SYMBOL = 'null';
const TOKEN_TRUE_SYMBOL = 'true';
const TOKEN_FALSE_SYMBOL = 'false';
const TOKEN_ALPHABET_LOWERCASE_A_SYMBOL = 'a';
const TOKEN_ALPHABET_LOWERCASE_B_SYMBOL = 'b';
const TOKEN_ALPHABET_LOWERCASE_C_SYMBOL = 'c';
const TOKEN_ALPHABET_LOWERCASE_D_SYMBOL = 'd';
const TOKEN_ALPHABET_LOWERCASE_E_SYMBOL = 'e';
const TOKEN_ALPHABET_LOWERCASE_F_SYMBOL = 'f';
const TOKEN_ALPHABET_LOWERCASE_L_SYMBOL = 'l';
const TOKEN_ALPHABET_LOWERCASE_N_SYMBOL = 'n';
const TOKEN_ALPHABET_LOWERCASE_R_SYMBOL = 'r';
const TOKEN_ALPHABET_LOWERCASE_S_SYMBOL = 's';
const TOKEN_ALPHABET_LOWERCASE_T_SYMBOL = 't';
const TOKEN_ALPHABET_LOWERCASE_U_SYMBOL = 'u';
const TOKEN_ALPHABET_UPPERCASE_A_SYMBOL = 'A';
const TOKEN_ALPHABET_UPPERCASE_B_SYMBOL = 'B';
const TOKEN_ALPHABET_UPPERCASE_C_SYMBOL = 'C';
const TOKEN_ALPHABET_UPPERCASE_D_SYMBOL = 'D';
const TOKEN_ALPHABET_UPPERCASE_E_SYMBOL = 'E';
const TOKEN_ALPHABET_UPPERCASE_F_SYMBOL = 'F';
const TOKEN_NUMBER_0_SYMBOL = '0';
const TOKEN_NUMBER_1_SYMBOL = '1';
const TOKEN_NUMBER_2_SYMBOL = '2';
const TOKEN_NUMBER_3_SYMBOL = '3';
const TOKEN_NUMBER_4_SYMBOL = '4';
const TOKEN_NUMBER_5_SYMBOL = '5';
const TOKEN_NUMBER_6_SYMBOL = '6';
const TOKEN_NUMBER_7_SYMBOL = '7';
const TOKEN_NUMBER_8_SYMBOL = '8';
const TOKEN_NUMBER_9_SYMBOL = '9';

// token symbol const
const TOKEN_SYMBOL_MAP: Record<Token, string> = {
  [TOKEN_EOF]: TOKEN_EOF_SYMBOL,
  [TOKEN_LEFT_BRACKET]: TOKEN_LEFT_BRACKET_SYMBOL,
  [TOKEN_RIGHT_BRACKET]: TOKEN_RIGHT_BRACKET_SYMBOL,
  [TOKEN_LEFT_BRACE]: TOKEN_LEFT_BRACE_SYMBOL,
  [TOKEN_RIGHT_BRACE]: TOKEN_RIGHT_BRACE_SYMBOL,
  [TOKEN_COLON]: TOKEN_COLON_SYMBOL,
  [TOKEN_DOT]: TOKEN_DOT_SYMBOL,
  [TOKEN_COMMA]: TOKEN_COMMA_SYMBOL,
  [TOKEN_QUOTE]: TOKEN_QUOTE_SYMBOL,
  [TOKEN_ESCAPE_CHARACTER]: TOKEN_ESCAPE_CHARACTER_SYMBOL,
  [TOKEN_SLASH]: TOKEN_SLASH_SYMBOL,
  [TOKEN_NEGATIVE]: TOKEN_NEGATIVE_SYMBOL,
  [TOKEN_NULL]: TOKEN_NULL_SYMBOL,
  [TOKEN_TRUE]: TOKEN_TRUE_SYMBOL,
  [TOKEN_FALSE]: TOKEN_FALSE_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_A]: TOKEN_ALPHABET_LOWERCASE_A_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_B]: TOKEN_ALPHABET_LOWERCASE_B_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_C]: TOKEN_ALPHABET_LOWERCASE_C_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_D]: TOKEN_ALPHABET_LOWERCASE_D_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_E]: TOKEN_ALPHABET_LOWERCASE_E_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_F]: TOKEN_ALPHABET_LOWERCASE_F_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_L]: TOKEN_ALPHABET_LOWERCASE_L_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_N]: TOKEN_ALPHABET_LOWERCASE_N_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_R]: TOKEN_ALPHABET_LOWERCASE_R_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_S]: TOKEN_ALPHABET_LOWERCASE_S_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_T]: TOKEN_ALPHABET_LOWERCASE_T_SYMBOL,
  [TOKEN_ALPHABET_LOWERCASE_U]: TOKEN_ALPHABET_LOWERCASE_U_SYMBOL,
  [TOKEN_ALPHABET_UPPERCASE_A]: TOKEN_ALPHABET_UPPERCASE_A_SYMBOL,
  [TOKEN_ALPHABET_UPPERCASE_B]: TOKEN_ALPHABET_UPPERCASE_B_SYMBOL,
  [TOKEN_ALPHABET_UPPERCASE_C]: TOKEN_ALPHABET_UPPERCASE_C_SYMBOL,
  [TOKEN_ALPHABET_UPPERCASE_D]: TOKEN_ALPHABET_UPPERCASE_D_SYMBOL,
  [TOKEN_ALPHABET_UPPERCASE_E]: TOKEN_ALPHABET_UPPERCASE_E_SYMBOL,
  [TOKEN_ALPHABET_UPPERCASE_F]: TOKEN_ALPHABET_UPPERCASE_F_SYMBOL,
  [TOKEN_NUMBER_0]: TOKEN_NUMBER_0_SYMBOL,
  [TOKEN_NUMBER_1]: TOKEN_NUMBER_1_SYMBOL,
  [TOKEN_NUMBER_2]: TOKEN_NUMBER_2_SYMBOL,
  [TOKEN_NUMBER_3]: TOKEN_NUMBER_3_SYMBOL,
  [TOKEN_NUMBER_4]: TOKEN_NUMBER_4_SYMBOL,
  [TOKEN_NUMBER_5]: TOKEN_NUMBER_5_SYMBOL,
  [TOKEN_NUMBER_6]: TOKEN_NUMBER_6_SYMBOL,
  [TOKEN_NUMBER_7]: TOKEN_NUMBER_7_SYMBOL,
  [TOKEN_NUMBER_8]: TOKEN_NUMBER_8_SYMBOL,
  [TOKEN_NUMBER_9]: TOKEN_NUMBER_9_SYMBOL,
  [TOKEN_IGNORED]: ' ', // Add missing tokens
  [TOKEN_OTHERS]: '',
  [TOKEN_NUMBER]: '0'
} as const;

// Types for the parser
interface CompletedSection {
  sectionName: string;
  sectionContent: string;
  sectionContentType?: string;
}

// helper method check if token is in ignore token
function isIgnoreToken(c: string): boolean {
  switch (c) {
    case '\t':
    case '\n':
    case '\v':
    case '\f':
    case '\r':
    case ' ':
      return true;
  }
  return false;
}

// get array real length
function arrayLength(a: any[]): number {
  if (!a) {
    return 0;
  }
  return Object.keys(a).filter(function (el) {
    return !(+el % 1) && +el >= 0 && +el < Math.pow(2, 32);
  }).length;
}

// helper method match stack with tokens
function matchStack(stack: Token[], tokens: Token[]): boolean {
  let pointer = arrayLength(stack);
  let tokensLeft = arrayLength(tokens);

  for (; ;) {
    tokensLeft--;
    pointer--;

    if (tokensLeft < 0) {
      break;
    }

    if (pointer < 0) {
      return false;
    }

    if (stack[pointer] !== tokens[tokensLeft]) {
      return false;
    }
  }

  return true;
}

// main lexer
class Lexer {
  private JSONContent: string = ''; // input JSON content
  private PaddingContent: string = ''; // padding content for ignored characters and escape characters, etc.
  private JSONSegment: string = ''; // appended JSON segment by the AppendString() method.
  private TokenStack: Token[] = []; // token stack for input JSON
  private MirrorTokenStack: Token[] = []; // token stack for auto-completed tokens
  private allowedSections: readonly string[] | null;
  private skipNonValidSections: boolean = false;
  private completedSections: CompletedSection[] = [];

  constructor(allowedSections: readonly string[] | null = null, skipNonValidSections: boolean = false) {
    this.allowedSections = allowedSections;
    this.skipNonValidSections = skipNonValidSections;
  }

  // Get token on the stack top
  private getTopTokenOnStack(): Token {
    if (this.TokenStack.length === 0) {
      return TOKEN_EOF;
    }
    return this.TokenStack[this.TokenStack.length - 1];
  }

  // Get token on the mirror stack top
  private getTopTokenOnMirrorStack(): Token {
    if (this.MirrorTokenStack.length === 0) {
      return TOKEN_EOF;
    }
    return this.MirrorTokenStack[this.MirrorTokenStack.length - 1];
  }

  // Pop token on the stack top
  private popTokenStack(): Token {
    if (this.TokenStack.length === 0) {
      return TOKEN_EOF;
    }
    return this.TokenStack.pop()!;
  }

  // Pop token on the mirror stack top
  private popMirrorTokenStack(): Token {
    if (this.MirrorTokenStack.length === 0) {
      return TOKEN_EOF;
    }
    return this.MirrorTokenStack.pop()!;
  }

  // Push token into the stack
  private pushTokenStack(token: Token): void {
    this.TokenStack.push(token);
  }

  // Push token into the mirror stack
  private pushMirrorTokenStack(token: Token): void {
    this.MirrorTokenStack.push(token);
  }

  // Convert mirror stack token into string
  private dumpMirrorTokenStackToString(): string {
    let ret = '';
    this.MirrorTokenStack.slice()
      .reverse()
      .forEach((item: Token) => {
        ret += TOKEN_SYMBOL_MAP[item];
      });
    return ret;
  }

  // Skip JSON segment by length n
  private skipJSONSegment(n: number): void {
    this.JSONSegment = this.JSONSegment.substring(n);
  }

  // Push negative symbol `-` into JSON content
  private pushNegativeIntoJSONContent(): void {
    this.JSONContent += TOKEN_NEGATIVE_SYMBOL;
  }

  // Push byte into JSON content by given
  private pushByteIntoPaddingContent(s: string): void {
    this.PaddingContent += s;
  }

  // Append padding content into JSON content
  private appendPaddingContentToJSONContent(): void {
    this.JSONContent += this.PaddingContent;
  }

  // Check if padding content is empty
  private havePaddingContent(): boolean {
    return this.PaddingContent.length > 0;
  }

  // Set padding content to empty
  private cleanPaddingContent(): void {
    this.PaddingContent = '';
  }

  // check if JSON stream stopped at an object property's key start, like `{"`
  private streamStoppedInAnObjectKeyStart(): boolean {
    // `{`, `"` in stack, or `,`, `"` in stack
    const case1 = [TOKEN_LEFT_BRACE, TOKEN_QUOTE];
    const case2 = [TOKEN_COMMA, TOKEN_QUOTE];
    // `}` in mirror stack
    const case3 = [TOKEN_RIGHT_BRACE];
    return (
      (matchStack(this.TokenStack, case1) ||
        matchStack(this.TokenStack, case2)) &&
      matchStack(this.MirrorTokenStack, case3)
    );
  }

  // check if JSON stream stopped in an object property's key, like `{"field`
  private streamStoppedInAnObjectKeyEnd(): boolean {
    // `{`, `"`, `"` in stack, or `,`, `"`, `"` in stack
    const case1 = [TOKEN_LEFT_BRACE, TOKEN_QUOTE, TOKEN_QUOTE];
    const case2 = [TOKEN_COMMA, TOKEN_QUOTE, TOKEN_QUOTE];
    // `"`, `:`, `n`, `u`, `l`, `l`, `}` in mirror stack
    const case3 = [
      TOKEN_RIGHT_BRACE,
      TOKEN_ALPHABET_LOWERCASE_L,
      TOKEN_ALPHABET_LOWERCASE_L,
      TOKEN_ALPHABET_LOWERCASE_U,
      TOKEN_ALPHABET_LOWERCASE_N,
      TOKEN_COLON,
      TOKEN_QUOTE,
    ];
    return (
      (matchStack(this.TokenStack, case1) ||
        matchStack(this.TokenStack, case2)) &&
      matchStack(this.MirrorTokenStack, case3)
    );
  }

  // check if JSON stream stopped in an object property's value start, like `{"field": "`
  private streamStoppedInAnObjectStringValueStart(): boolean {
    // `:`, `"` in stack
    const case1 = [TOKEN_COLON, TOKEN_QUOTE];
    // `n`, `u`, `l`, `l`, `}` in mirror stack
    const case2 = [
      TOKEN_RIGHT_BRACE,
      TOKEN_ALPHABET_LOWERCASE_L,
      TOKEN_ALPHABET_LOWERCASE_L,
      TOKEN_ALPHABET_LOWERCASE_U,
      TOKEN_ALPHABET_LOWERCASE_N,
    ];
    return (
      matchStack(this.TokenStack, case1) &&
      matchStack(this.MirrorTokenStack, case2)
    );
  }

  // check if JSON stream stopped in an object property's value finish, like `{"field": "value"`
  private streamStoppedInAnObjectValueEnd(): boolean {
    // `"`, `}` left
    const tokens = [TOKEN_RIGHT_BRACE, TOKEN_QUOTE];
    return matchStack(this.MirrorTokenStack, tokens);
  }

  // check if JSON stream stopped in an object property's value start by array, like `{"field":[`
  private streamStoppedInAnObjectArrayValueStart(): boolean {
    // `:`, `[` in stack
    const case1 = [TOKEN_COLON, TOKEN_LEFT_BRACKET];
    // `n`, `u`, `l`, `l`, `}` in mirror stack
    const case2 = [
      TOKEN_RIGHT_BRACE,
      TOKEN_ALPHABET_LOWERCASE_L,
      TOKEN_ALPHABET_LOWERCASE_L,
      TOKEN_ALPHABET_LOWERCASE_U,
      TOKEN_ALPHABET_LOWERCASE_N,
    ];
    return (
      matchStack(this.TokenStack, case1) &&
      matchStack(this.MirrorTokenStack, case2)
    );
  }

  // check if JSON stream stopped in an object property's value start by object, like `{"field":{`
  private streamStoppedInAnObjectObjectValueStart(): boolean {
    // `:`, `{` in stack
    const case1 = [TOKEN_COLON, TOKEN_LEFT_BRACE];
    // `n`, `u`, `l`, `l`, `}` in mirror stack
    const case2 = [
      TOKEN_RIGHT_BRACE,
      TOKEN_ALPHABET_LOWERCASE_L,
      TOKEN_ALPHABET_LOWERCASE_L,
      TOKEN_ALPHABET_LOWERCASE_U,
      TOKEN_ALPHABET_LOWERCASE_N,
    ];
    return (
      matchStack(this.TokenStack, case1) &&
      matchStack(this.MirrorTokenStack, case2)
    );
  }

  // check if JSON stream stopped in an object property's negative number value start, like `:-`
  private streamStoppedInAnObjectNegativeNumberValueStart(): boolean {
    // `:`, `-` in stack
    const case1 = [TOKEN_COLON, TOKEN_NEGATIVE];
    return matchStack(this.TokenStack, case1);
  }

  // check if JSON stream stopped in an object property's negative number value start, like `-`
  private streamStoppedInANegativeNumberValueStart(): boolean {
    // `-` in stack
    const case1 = [TOKEN_NEGATIVE];
    // `0` in mirror stack
    const case2 = [TOKEN_NUMBER_0];
    return (
      matchStack(this.TokenStack, case1) &&
      matchStack(this.MirrorTokenStack, case2)
    );
  }

  // check if JSON stream stopped in an array
  private streamStoppedInAnArray(): boolean {
    return this.getTopTokenOnMirrorStack() === TOKEN_RIGHT_BRACKET;
  }

  // check if JSON stream stopped in an array's string value end, like `["value"]`
  private streamStoppedInAnArrayStringValueEnd(): boolean {
    // `"`, `"` in stack
    const case1 = [TOKEN_QUOTE, TOKEN_QUOTE];
    // `"`, `]` in mirror stack
    const case2 = [TOKEN_RIGHT_BRACKET, TOKEN_QUOTE];
    return (
      matchStack(this.TokenStack, case1) &&
      matchStack(this.MirrorTokenStack, case2)
    );
  }

  // check if JSON stream stopped in an object property's value start by array, like `{"field":{`
  private streamStoppedInAnObjectNullValuePlaceholderStart(): boolean {
    // `n`, `u`, `l`, `l`, `}` in mirror stack
    const case1 = [
      TOKEN_RIGHT_BRACE,
      TOKEN_ALPHABET_LOWERCASE_L,
      TOKEN_ALPHABET_LOWERCASE_L,
      TOKEN_ALPHABET_LOWERCASE_U,
      TOKEN_ALPHABET_LOWERCASE_N,
    ];
    return matchStack(this.MirrorTokenStack, case1);
  }

  // check if JSON stream stopped in a string, like `""`
  private streamStoppedInAString(): boolean {
    return (
      this.getTopTokenOnStack() === TOKEN_QUOTE &&
      this.getTopTokenOnMirrorStack() === TOKEN_QUOTE
    );
  }

  // check if JSON stream stopped in a string's unicode escape, like `\u????`
  private streamStoppedInAnStringUnicodeEscape(): boolean {
    // `\`, `u` in stack
    const case1 = [TOKEN_ESCAPE_CHARACTER, TOKEN_ALPHABET_LOWERCASE_U];
    // `"` in mirror stack
    const case2 = [TOKEN_QUOTE];
    return (
      matchStack(this.TokenStack, case1) &&
      matchStack(this.MirrorTokenStack, case2)
    );
  }

  // check if JSON stream stopped in a number, like `[0-9]`
  private streamStoppedInANumber(): boolean {
    return this.getTopTokenOnStack() === TOKEN_NUMBER;
  }

  // check if JSON stream stopped in a number first decimal place, like `.?`
  private streamStoppedInANumberDecimalPart(): boolean {
    return this.getTopTokenOnStack() === TOKEN_DOT;
  }

  // check if JSON stream stopped in a number other decimal places (except first place), like `.[0-9]?`
  private streamStoppedInANumberDecimalPartMiddle(): boolean {
    // `.`, TOKEN_NUMBER in stack
    const case1 = [TOKEN_DOT, TOKEN_NUMBER];
    return matchStack(this.TokenStack, case1);
  }

  // check if JSON stream stopped in escape character, like `\`
  private streamStoppedWithLeadingEscapeCharacter(): boolean {
    return this.getTopTokenOnStack() === TOKEN_ESCAPE_CHARACTER;
  }

  // lexer match JSON token method, convert JSON segment to JSON token
  private matchToken(): [Token, string] {
    // segment end
    if (this.JSONSegment.length === 0) {
      return [TOKEN_EOF, ''];
    }
    let tokenSymbol = this.JSONSegment.substring(0, 1);

    // check if ignored token
    if (isIgnoreToken(tokenSymbol)) {
      this.skipJSONSegment(1);
      return [TOKEN_IGNORED, tokenSymbol];
    }

    // match token
    switch (tokenSymbol) {
      case TOKEN_LEFT_BRACKET_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_LEFT_BRACKET, tokenSymbol];
      case TOKEN_RIGHT_BRACKET_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_RIGHT_BRACKET, tokenSymbol];
      case TOKEN_LEFT_BRACE_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_LEFT_BRACE, tokenSymbol];
      case TOKEN_RIGHT_BRACE_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_RIGHT_BRACE, tokenSymbol];
      case TOKEN_COLON_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_COLON, tokenSymbol];
      case TOKEN_DOT_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_DOT, tokenSymbol];
      case TOKEN_COMMA_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_COMMA, tokenSymbol];
      case TOKEN_QUOTE_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_QUOTE, tokenSymbol];
      case TOKEN_ESCAPE_CHARACTER_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ESCAPE_CHARACTER, tokenSymbol];
      case TOKEN_SLASH_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_SLASH, tokenSymbol];
      case TOKEN_NEGATIVE_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NEGATIVE, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_A_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_A, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_B_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_B, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_C_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_C, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_D_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_D, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_E_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_E, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_F_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_F, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_L_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_L, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_N_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_N, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_R_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_R, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_S_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_S, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_T_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_T, tokenSymbol];
      case TOKEN_ALPHABET_LOWERCASE_U_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_LOWERCASE_U, tokenSymbol];
      case TOKEN_ALPHABET_UPPERCASE_A_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_UPPERCASE_A, tokenSymbol];
      case TOKEN_ALPHABET_UPPERCASE_B_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_UPPERCASE_B, tokenSymbol];
      case TOKEN_ALPHABET_UPPERCASE_C_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_UPPERCASE_C, tokenSymbol];
      case TOKEN_ALPHABET_UPPERCASE_D_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_UPPERCASE_D, tokenSymbol];
      case TOKEN_ALPHABET_UPPERCASE_E_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_UPPERCASE_E, tokenSymbol];
      case TOKEN_ALPHABET_UPPERCASE_F_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_ALPHABET_UPPERCASE_F, tokenSymbol];
      case TOKEN_NUMBER_0_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NUMBER_0, tokenSymbol];
      case TOKEN_NUMBER_1_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NUMBER_1, tokenSymbol];
      case TOKEN_NUMBER_2_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NUMBER_2, tokenSymbol];
      case TOKEN_NUMBER_3_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NUMBER_3, tokenSymbol];
      case TOKEN_NUMBER_4_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NUMBER_4, tokenSymbol];
      case TOKEN_NUMBER_5_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NUMBER_5, tokenSymbol];
      case TOKEN_NUMBER_6_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NUMBER_6, tokenSymbol];
      case TOKEN_NUMBER_7_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NUMBER_7, tokenSymbol];
      case TOKEN_NUMBER_8_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NUMBER_8, tokenSymbol];
      case TOKEN_NUMBER_9_SYMBOL:
        this.skipJSONSegment(1);
        return [TOKEN_NUMBER_9, tokenSymbol];
      default:
        this.skipJSONSegment(1);
        return [TOKEN_OTHERS, tokenSymbol];
    }
  }

  // append JSON string to current JSON stream content
  // this method will traversal all token and generate mirror token for complete full JSON
  private AppendString(str: string): void {
    this.JSONSegment = str;
    for (; ;) {
      let [token, tokenSymbol] = this.matchToken();

      switch (token) {
        case TOKEN_EOF:
          // nothing to do with TOKEN_EOF
          break;
        case TOKEN_IGNORED:
          if (this.streamStoppedInAString()) {
            this.JSONContent += tokenSymbol;
            continue;
          }
          this.pushByteIntoPaddingContent(tokenSymbol);
          break;

        case TOKEN_OTHERS:
          // check if JSON stream stopped with padding content
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;
          break;

        case TOKEN_LEFT_BRACKET:
          // check if JSON stream stopped with padding content
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }
          this.JSONContent += tokenSymbol;
          if (this.streamStoppedInAString()) {
            continue;
          }
          this.pushTokenStack(token);
          if (this.streamStoppedInAnObjectArrayValueStart()) {
            // pop `n`, `u`, `l`, `l` from mirror stack
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
          }

          // push `]` into mirror stack
          this.pushMirrorTokenStack(TOKEN_RIGHT_BRACKET);
          break;

        case TOKEN_RIGHT_BRACKET:
          if (this.streamStoppedInAString()) {
            this.JSONContent += tokenSymbol;
            continue;
          }

          // check if JSON stream stopped with padding content
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // push `]` into stack
          this.pushTokenStack(token);
          // pop `]` from mirror stack
          this.popMirrorTokenStack();
          break;

        case TOKEN_LEFT_BRACE:
          // check if JSON stream stopped with padding content
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          if (this.streamStoppedInAString()) {
            continue;
          }
          this.pushTokenStack(token);

          if (this.streamStoppedInAnObjectObjectValueStart()) {
            // pop `n`, `u`, `l`, `l` from mirror stack
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
          }

          // push `}` into mirror stack
          this.pushMirrorTokenStack(TOKEN_RIGHT_BRACE);
          break;

        case TOKEN_RIGHT_BRACE:
          if (this.streamStoppedInAString()) {
            this.JSONContent += tokenSymbol;
            continue;
          }

          // check if JSON stream stopped with padding content
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }
          this.JSONContent += tokenSymbol;

          // push `}` into stack
          this.pushTokenStack(token);
          // pop `}` from mirror stack
          this.popMirrorTokenStack();
          break;
        case TOKEN_QUOTE:
          // check if escape quote `\"`
          if (this.streamStoppedWithLeadingEscapeCharacter()) {
            // push padding escape character `\` into JSON content
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();

            // write current token symbol to JSON content
            this.JSONContent += tokenSymbol;

            // pop `\` from stack
            this.popTokenStack();
            continue;
          }

          // check if json stream stopped with padding content
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;
          this.pushTokenStack(token);
          if (this.streamStoppedInAnArray()) {
            // push `"` into mirror stack
            this.pushMirrorTokenStack(TOKEN_QUOTE);
          } else if (this.streamStoppedInAnArrayStringValueEnd()) {
            // pop `"` from mirror stack
            this.popMirrorTokenStack();
          } else if (this.streamStoppedInAnObjectKeyStart()) {
            // push `"`, `:`, `n`, `u`, `l`, `l` into mirror stack
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_L);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_L);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_U);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_N);
            this.pushMirrorTokenStack(TOKEN_COLON);
            this.pushMirrorTokenStack(TOKEN_QUOTE);
          } else if (this.streamStoppedInAnObjectKeyEnd()) {
            // pop `"` from mirror stack
            this.popMirrorTokenStack();
          } else if (this.streamStoppedInAnObjectStringValueStart()) {
            // pop `n`, `u`, `l`, `l` from mirror stack
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            // push `"` into mirror stack
            this.pushMirrorTokenStack(TOKEN_QUOTE);
          } else if (this.streamStoppedInAnObjectValueEnd()) {
            // pop `"` from mirror stack
            this.popMirrorTokenStack();
          } else {
            throw new Error('invalid quote token in json stream');
          }
          break;
        case TOKEN_COLON:
          if (this.streamStoppedInAString()) {
            this.JSONContent += tokenSymbol;
            continue;
          }

          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }

          this.JSONContent += tokenSymbol;
          this.pushTokenStack(token);
          this.popMirrorTokenStack();
          break;

        case TOKEN_ALPHABET_LOWERCASE_A:
          if (this.streamStoppedInAnStringUnicodeEscape()) {
            this.pushByteIntoPaddingContent(tokenSymbol);
            if (this.PaddingContent.length === 6) {
              this.appendPaddingContentToJSONContent();
              this.cleanPaddingContent();
              this.popTokenStack();
              this.popTokenStack();
            }
            continue;
          }

          this.JSONContent += tokenSymbol;

          if (this.streamStoppedInAString()) {
            continue;
          }

          const itIsPartOfTokenFalse = () => {
            const left = [TOKEN_ALPHABET_LOWERCASE_F];
            const right = [
              TOKEN_ALPHABET_LOWERCASE_E,
              TOKEN_ALPHABET_LOWERCASE_S,
              TOKEN_ALPHABET_LOWERCASE_L,
              TOKEN_ALPHABET_LOWERCASE_A,
            ];
            return (
              matchStack(this.TokenStack, left) &&
              matchStack(this.MirrorTokenStack, right)
            );
          };

          if (!itIsPartOfTokenFalse()) {
            continue;
          }

          this.pushTokenStack(token);
          this.popMirrorTokenStack();
          break;
        case TOKEN_ALPHABET_LOWERCASE_B:
          // as hex in unicode
          if (this.streamStoppedInAnStringUnicodeEscape()) {
            this.pushByteIntoPaddingContent(tokenSymbol);

            // check if unicode escape is full length
            if (this.PaddingContent.length === 6) {
              this.appendPaddingContentToJSONContent();
              this.cleanPaddingContent();

              // pop `\`, `u` from stack
              this.popTokenStack();
              this.popTokenStack();
            }
            continue;
          }

          // \b escape `\`, `b`
          if (this.streamStoppedWithLeadingEscapeCharacter()) {
            // push padding escape character `\` into JSON content
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();

            // write current token symbol to JSON content
            this.JSONContent += tokenSymbol;

            // pop `\` from  stack
            this.popTokenStack();
            continue;
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }
          break;

        case TOKEN_ALPHABET_LOWERCASE_E:
          // as hex in unicode
          if (this.streamStoppedInAnStringUnicodeEscape()) {
            this.pushByteIntoPaddingContent(tokenSymbol);

            // check if unicode escape is full length
            if (this.PaddingContent.length === 6) {
              this.appendPaddingContentToJSONContent();
              this.cleanPaddingContent();

              // pop `\`, `u` from stack
              this.popTokenStack();
              this.popTokenStack();
            }
            continue;
          }

          // check if in a number, as `e` (exponent) in scientific notation
          if (this.streamStoppedInANumberDecimalPartMiddle()) {
            this.pushByteIntoPaddingContent(tokenSymbol);
            continue;
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }
          // Omitting boolean validation functions due to placeholder logic

          this.pushTokenStack(token);
          this.popMirrorTokenStack();
          break;
        case TOKEN_ALPHABET_LOWERCASE_F:
          // as hex in unicode
          if (this.streamStoppedInAnStringUnicodeEscape()) {
            this.pushByteIntoPaddingContent(tokenSymbol);
            // check if unicode escape is full length
            if (this.PaddingContent.length === 6) {
              this.appendPaddingContentToJSONContent();
              this.cleanPaddingContent();
              // pop `\`, `u` from stack
              this.popTokenStack();
              this.popTokenStack();
            }
            continue;
          }

          // \f escape `\`, `f`
          if (this.streamStoppedWithLeadingEscapeCharacter()) {
            // push padding escape character `\` into JSON content
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();

            // write current token symbol to JSON content
            this.JSONContent += tokenSymbol;

            // pop `\` from stack
            this.popTokenStack();
            continue;
          }

          // check if json stream stopped with padding content, like case `[true , f`
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }

          // push `f` into stack
          this.pushTokenStack(token);
          if (this.streamStoppedInAnArray()) {
            // in array
            // push `a`, `l`, `s`, `e`
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_E);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_S);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_L);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_A);
          } else {
            // in object
            // pop `n`, `u`, `l`, `l`
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            // push `a`, `l`, `s`, `e`
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_E);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_S);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_L);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_A);
          }
          break;
        case TOKEN_ALPHABET_LOWERCASE_L:
          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }

          // helper functions to check stack states
          const itIsPartOfTokenFalse1 = () => {
            const left = [
              TOKEN_ALPHABET_LOWERCASE_F,
              TOKEN_ALPHABET_LOWERCASE_A,
            ];
            const right = [
              TOKEN_ALPHABET_LOWERCASE_E,
              TOKEN_ALPHABET_LOWERCASE_S,
              TOKEN_ALPHABET_LOWERCASE_L,
            ];
            return (
              matchStack(this.TokenStack, left) &&
              matchStack(this.MirrorTokenStack, right)
            );
          };

          const itIsPartOfTokenNull1 = () => {
            const left = [
              TOKEN_ALPHABET_LOWERCASE_N,
              TOKEN_ALPHABET_LOWERCASE_U,
            ];
            const right = [
              TOKEN_ALPHABET_LOWERCASE_L,
              TOKEN_ALPHABET_LOWERCASE_L,
            ];
            return (
              matchStack(this.TokenStack, left) &&
              matchStack(this.MirrorTokenStack, right)
            );
          };

          const itIsPartOfTokenNull2 = () => {
            const left = [
              TOKEN_ALPHABET_LOWERCASE_N,
              TOKEN_ALPHABET_LOWERCASE_U,
              TOKEN_ALPHABET_LOWERCASE_L,
            ];
            const right = [TOKEN_ALPHABET_LOWERCASE_L];
            return (
              matchStack(this.TokenStack, left) &&
              matchStack(this.MirrorTokenStack, right)
            );
          };

          if (
            !itIsPartOfTokenFalse1() &&
            !itIsPartOfTokenNull1() &&
            !itIsPartOfTokenNull2()
          ) {
            continue;
          }

          this.pushTokenStack(token);
          this.popMirrorTokenStack();
          break;
        case TOKEN_ALPHABET_LOWERCASE_N:
          // \n escape `\`, `n`
          if (this.streamStoppedWithLeadingEscapeCharacter()) {
            // Push padding escape character `\` into JSON content
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();

            // Write current token symbol to JSON content
            this.JSONContent += tokenSymbol;

            // Pop `\` from stack
            this.popTokenStack();
            continue;
          }

          // Check if JSON stream stopped with padding content, like case `[true, n`
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }

          // Write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // In a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }

          // Push `n`
          this.pushTokenStack(token);
          if (this.streamStoppedInAnArray()) {
            // In array, push `u`, `l`, `l`
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_L);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_L);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_U);
          } else {
            // In object, pop `n`
            this.popMirrorTokenStack();
          }
          break;
        case TOKEN_ALPHABET_LOWERCASE_R:
          // \r escape `\`, `r`
          if (this.streamStoppedWithLeadingEscapeCharacter()) {
            // push padding escape character `\` into JSON content
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();

            // write current token symbol to JSON content
            this.JSONContent += tokenSymbol;

            // pop `\` from stack
            this.popTokenStack();
            continue;
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }

          // check if `t` in token stack and `r`, `u`, `e` in mirror stack
          const itIsPartOfTokenTrue = () => {
            const left = [TOKEN_ALPHABET_LOWERCASE_T];
            const right = [
              TOKEN_ALPHABET_LOWERCASE_E,
              TOKEN_ALPHABET_LOWERCASE_U,
              TOKEN_ALPHABET_LOWERCASE_R,
            ];
            return (
              matchStack(this.TokenStack, left) &&
              matchStack(this.MirrorTokenStack, right)
            );
          };

          if (!itIsPartOfTokenTrue()) {
            continue;
          }

          this.pushTokenStack(token);
          this.popMirrorTokenStack();
          break;
        case TOKEN_ALPHABET_LOWERCASE_S:
          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }

          // check if `f`, `a`, `l` in token stack and `s`, `e in mirror stack
          const itIsPartOfTokenFalse2 = () => {
            const left = [
              TOKEN_ALPHABET_LOWERCASE_F,
              TOKEN_ALPHABET_LOWERCASE_A,
              TOKEN_ALPHABET_LOWERCASE_L,
            ];
            const right = [
              TOKEN_ALPHABET_LOWERCASE_E,
              TOKEN_ALPHABET_LOWERCASE_S,
            ];
            return (
              matchStack(this.TokenStack, left) &&
              matchStack(this.MirrorTokenStack, right)
            );
          };
          if (!itIsPartOfTokenFalse2()) {
            continue;
          }
          this.pushTokenStack(token);
          this.popMirrorTokenStack();
          break;
        case TOKEN_ALPHABET_LOWERCASE_T:
          // \t escape `\`, `t`
          if (this.streamStoppedWithLeadingEscapeCharacter()) {
            // push padding escape character `\` into JSON content
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();

            // write current token symbol to JSON content
            this.JSONContent += tokenSymbol;

            // pop `\` from stack
            this.popTokenStack();
            continue;
          }

          // check if json stream stopped with padding content, like case `[true , t`
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }

          // push `t` to stack
          this.pushTokenStack(token);
          if (this.streamStoppedInAnArray()) {
            // in array
            // push `r`, `u`, `e`
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_E);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_U);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_R);
          } else {
            // in object
            // pop `n`, `u`, `l`, `l`
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            // push `r`, `u`, `e`
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_E);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_U);
            this.pushMirrorTokenStack(TOKEN_ALPHABET_LOWERCASE_R);
          }
          break;
        case TOKEN_ALPHABET_LOWERCASE_U:
          // unicode escape `\`, `u`
          if (this.streamStoppedWithLeadingEscapeCharacter()) {
            this.pushTokenStack(token);
            this.PaddingContent += tokenSymbol;
            continue;
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }

          // check if `t`, `r` in token stack and, `u`, `e` in mirror stack
          const itIsPartOfTokenTrue2 = () => {
            const left = [
              TOKEN_ALPHABET_LOWERCASE_T,
              TOKEN_ALPHABET_LOWERCASE_R,
            ];
            const right = [
              TOKEN_ALPHABET_LOWERCASE_E,
              TOKEN_ALPHABET_LOWERCASE_U,
            ];
            return (
              matchStack(this.TokenStack, left) &&
              matchStack(this.MirrorTokenStack, right)
            );
          };

          // check if `n` in token stack and `u`, `l`, `l` in mirror stack
          const itIsPartOfTokenNull = () => {
            const left = [TOKEN_ALPHABET_LOWERCASE_N];
            const right = [
              TOKEN_ALPHABET_LOWERCASE_L,
              TOKEN_ALPHABET_LOWERCASE_L,
              TOKEN_ALPHABET_LOWERCASE_U,
            ];
            return (
              matchStack(this.TokenStack, left) &&
              matchStack(this.MirrorTokenStack, right)
            );
          };
          if (!itIsPartOfTokenTrue2() && !itIsPartOfTokenNull()) {
            continue;
          }
          this.pushTokenStack(token);
          this.popMirrorTokenStack();
          break;
        case TOKEN_ALPHABET_UPPERCASE_A:
        case TOKEN_ALPHABET_UPPERCASE_B:
        case TOKEN_ALPHABET_UPPERCASE_C:
        case TOKEN_ALPHABET_UPPERCASE_D:
        case TOKEN_ALPHABET_LOWERCASE_C:
        case TOKEN_ALPHABET_LOWERCASE_D:
        case TOKEN_ALPHABET_UPPERCASE_F:
          // as hex in unicode
          if (this.streamStoppedInAnStringUnicodeEscape()) {
            this.pushByteIntoPaddingContent(tokenSymbol);
            // check if unicode escape is full length
            if (this.PaddingContent.length === 6) {
              this.appendPaddingContentToJSONContent();
              this.cleanPaddingContent();
              // pop `\`, `u` from stack
              this.popTokenStack();
              this.popTokenStack();
            }
            continue;
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }
          break;
        case TOKEN_ALPHABET_UPPERCASE_E:
          // as hex in unicode
          if (this.streamStoppedInAnStringUnicodeEscape()) {
            this.pushByteIntoPaddingContent(tokenSymbol);
            // check if unicode escape is full length
            if (this.PaddingContent.length === 6) {
              this.appendPaddingContentToJSONContent();
              this.cleanPaddingContent();
              // pop `\`, `u` from stack
              this.popTokenStack();
              this.popTokenStack();
            }
            continue;
          }

          // check if in a number, as `E` (exponent) in scientific notation
          if (this.streamStoppedInANumberDecimalPartMiddle()) {
            this.pushByteIntoPaddingContent(tokenSymbol);
            continue;
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }
          break;
        case TOKEN_NUMBER_0:
        case TOKEN_NUMBER_1:
        case TOKEN_NUMBER_2:
        case TOKEN_NUMBER_3:
        case TOKEN_NUMBER_4:
        case TOKEN_NUMBER_5:
        case TOKEN_NUMBER_6:
        case TOKEN_NUMBER_7:
        case TOKEN_NUMBER_8:
        case TOKEN_NUMBER_9:
          if (this.streamStoppedInAnStringUnicodeEscape()) {
            this.pushByteIntoPaddingContent(tokenSymbol);
            // check if unicode escape is full length
            if (this.PaddingContent.length === 6) {
              this.appendPaddingContentToJSONContent();
              this.cleanPaddingContent();
              // pop `\`, `u` from stack
              this.popTokenStack();
              this.popTokenStack();
            }
            continue;
          }

          // check if json stream stopped with padding content, like `[1 , 1`
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }

          // in negative part of a number
          if (this.streamStoppedInANegativeNumberValueStart()) {
            this.pushNegativeIntoJSONContent();
            // pop `0` from mirror stack
            this.popMirrorTokenStack();
          }

          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string or a number, just skip token
          if (this.streamStoppedInAString() || this.streamStoppedInANumber()) {
            continue;
          }

          // in decimal part of a number
          if (this.streamStoppedInANumberDecimalPart()) {
            this.pushTokenStack(TOKEN_NUMBER);
            // pop placeholder `0` in decimal part
            this.popMirrorTokenStack();
            continue;
          }

          // first number type token, push token into stack
          this.pushTokenStack(TOKEN_NUMBER);

          // check if we are in an object or an array
          if (this.streamStoppedInAnArray()) {
            continue;
          } else if (this.streamStoppedInAnObjectNullValuePlaceholderStart()) {
            // pop `n`, `u`, `l`, `l`
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
            this.popMirrorTokenStack();
          }
          break;
        case TOKEN_COMMA:
          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            this.JSONContent += tokenSymbol;
            continue;
          }
          // in a object or a array, keep the comma in stack but not write it into JSONContent, until next token arrival
          this.pushByteIntoPaddingContent(tokenSymbol);
          this.pushTokenStack(token);
          break;
        case TOKEN_DOT:
          // write current token symbol to JSON content
          this.JSONContent += tokenSymbol;

          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            continue;
          }

          // use 0 for decimal part placeholder
          this.pushTokenStack(token);
          this.pushMirrorTokenStack(TOKEN_NUMBER_0);
          break;
        case TOKEN_SLASH:
          // escape character `\`, `/`
          if (this.streamStoppedWithLeadingEscapeCharacter()) {
            // push padding escape character `\` into JSON content
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();

            // write current token symbol to JSON content
            this.JSONContent += tokenSymbol;

            // pop `\` from stack
            this.popTokenStack();
            continue;
          } else if (this.streamStoppedInAString()) {
            this.JSONContent += tokenSymbol;
            continue;
          }
          break;
        case TOKEN_ESCAPE_CHARACTER: // TOKEN_ESCAPE_CHARACTER needs to be defined somewhere
          // double escape character `\`, `\`
          if (this.streamStoppedWithLeadingEscapeCharacter()) {
            // push padding escape character `\` into JSON content
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();

            // write current token symbol to JSON content
            this.JSONContent += tokenSymbol;

            // pop `\` from stack
            this.popTokenStack();
            continue;
          }

          // just write escape character into stack and waiting other token trigger escape method.
          this.pushTokenStack(token);
          this.pushByteIntoPaddingContent(TOKEN_ESCAPE_CHARACTER_SYMBOL); // TOKEN_ESCAPE_CHARACTER_SYMBOL needs to be defined somewhere
          break;
        case TOKEN_NEGATIVE: // TOKEN_NEGATIVE needs to be defined somewhere
          // in a string, just skip token
          if (this.streamStoppedInAString()) {
            this.JSONContent += tokenSymbol;
            continue;
          }

          // check if JSON stream stopped with padding content, like `[1 , -`
          if (this.havePaddingContent()) {
            this.appendPaddingContentToJSONContent();
            this.cleanPaddingContent();
          }

          // just write negative character into stack and wait for other token to trigger it.
          this.pushTokenStack(token);
          if (this.streamStoppedInAnObjectNegativeNumberValueStart()) {
            // pop `n`, `u`, `l`, `l` from mirror stack
            for (let i = 0; i < 4; i++) {
              // assuming "null" has been pushed into the stack as separate characters
              this.popMirrorTokenStack();
            }
          }

          // push `0` into mirror stack for placeholder
          this.pushMirrorTokenStack(TOKEN_NUMBER_0); // TOKEN_NUMBER_0 needs to be defined somewhere
          break;
        default:
          throw new Error(
            `unexpected token: \`${token}\`, token symbol: \`${tokenSymbol}\``,
          );
      }

      // check if end
      if (token === TOKEN_EOF) {
        break;
      }
    }
  }

  // Complete the incomplete JSON string by concat JSON content and mirror tokens
  CompleteJSON(): string {
    return this.JSONContent + this.dumpMirrorTokenStackToString();
  }

  // Public interface methods to match JSONStreamParser
  processToken(token: string): void {
    this.AppendString(token);
  }

  resetAll(): void {
    console.log('lexical parser resetAll');
    this.JSONContent = '';
    this.PaddingContent = '';
    this.JSONSegment = '';
    this.TokenStack = [];
    this.MirrorTokenStack = [];
    this.completedSections = [];
  }
  private splitTopLevelObjects(s: string) {
    const out = [];
    let start = -1;
    let depth = 0;
    let inStr = false;
    let esc = false;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];

      if (depth === 0) {
        if (ch === '{') {
          start = i;
          depth = 1;
        }
        continue;
      }

      if (inStr) {
        if (esc) {
          esc = false;
        } else if (ch === '\\') {
          esc = true;
        } else if (ch === '"') {
          inStr = false;
        }
      } else {
        if (ch === '"') {
          inStr = true;
          esc = false;
        } else if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0) {
            out.push(s.slice(start, i + 1));
            start = -1;
          }
        }
      }
    }
    return out;
  }
  // Example
  // console.log(splitTopLevelObjects('{"hey": 2}{"man": 3}'));
  // -> ['{"hey": 2}', '{"man": 3}']
  getCompletedSections(): any[] {
    // For LexicalParser, we need to parse the JSON and extract sections like JSONStreamParser
    if (this.JSONContent.trim()) {
      try {
        // const completedJSON = this.CompleteJSON();
        // Debug: console.log('lexical parser completedJSON', completedJSON);
        const completedJSON = this.CompleteJSON();

        // const parsed = JSON.parse(completedJSON);
        // console.log('lexical parser parsed', parsed);

        // Convert parsed JSON into separate sections like JSONStreamParser does
        const sections: any[] = [];
        const topLevelObjects = this.splitTopLevelObjects(completedJSON);

        // Handle each property as a separate section
        topLevelObjects.forEach(objstr => {
          const parsed = JSON.parse(objstr);
          Object.keys(parsed).forEach(key => {
            const section: Record<string, any> = {};
            section[key] = parsed[key];
            sections.push(section);
          });
        });

        return sections;
      } catch (error) {
        // If JSON is incomplete or malformed, try to extract what we can
        // or return raw content as response section
        return [{ response: this.JSONContent }];
      }
    }
    return [];
  }

  private isValidSection(section: string): boolean {
    if (this.skipNonValidSections) return true;
    if (this.allowedSections === null) return true;
    return this.allowedSections.includes(section);
  }
}

export { Lexer };
