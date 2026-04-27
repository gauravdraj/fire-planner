export type FilingStatus = 'single' | 'mfj' | 'hoh' | 'mfs';

export type Bracket = {
  from: number;
  rate: number;
};

export type BracketTable = Record<FilingStatus, readonly Bracket[]>;

export type LtcgBracketTable = Record<FilingStatus, readonly { from: number; rate: number }[]>;

export type MagiYear = {
  year: number;
  magi: number;
};
