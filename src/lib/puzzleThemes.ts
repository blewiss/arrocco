/**
 * Traduzioni dei temi dei puzzle Lichess.
 *
 * L'API restituisce le chiavi in inglese; le mostriamo in italiano. Un tema
 * non presente in questa mappa viene reso con la chiave originale, quindi
 * l'elenco può restare incompleto senza rompere nulla.
 */
export const THEME_LABELS: Record<string, string> = {
  // Fasi di gioco
  opening: 'Apertura',
  middlegame: 'Medio gioco',
  endgame: 'Finale',
  rookEndgame: 'Finale di torri',
  bishopEndgame: 'Finale di alfieri',
  pawnEndgame: 'Finale di pedoni',
  knightEndgame: 'Finale di cavalli',
  queenEndgame: 'Finale di donne',
  queenRookEndgame: 'Finale donna e torre',

  // Lunghezza
  oneMove: 'Una mossa',
  short: 'Corto',
  long: 'Lungo',
  veryLong: 'Molto lungo',

  // Matti
  mate: 'Matto',
  mateIn1: 'Matto in 1',
  mateIn2: 'Matto in 2',
  mateIn3: 'Matto in 3',
  mateIn4: 'Matto in 4',
  mateIn5: 'Matto in 5 o più',
  smotheredMate: 'Matto soffocato',
  backRankMate: "Matto sull'ultima traversa",
  anastasiaMate: 'Matto di Anastasia',
  arabianMate: 'Matto arabo',
  bodenMate: 'Matto di Boden',
  doubleBishopMate: 'Matto dei due alfieri',
  dovetailMate: 'Matto a coda di rondine',
  hookMate: 'Matto a uncino',
  killBoxMate: 'Matto della scatola',
  vukovicMate: 'Matto di Vukovic',

  // Motivi tattici
  advantage: 'Vantaggio',
  crushing: 'Schiacciante',
  equality: 'Parità',
  fork: 'Forchetta',
  pin: 'Inchiodatura',
  skewer: 'Infilata',
  discoveredAttack: 'Attacco di scoperta',
  doubleCheck: 'Scacco doppio',
  hangingPiece: 'Pezzo indifeso',
  trappedPiece: 'Pezzo intrappolato',
  attraction: 'Attrazione',
  deflection: 'Deviazione',
  interference: 'Interferenza',
  intermezzo: 'Intermezzo',
  clearance: 'Sgombero',
  quietMove: 'Mossa tranquilla',
  defensiveMove: 'Mossa difensiva',
  zugzwang: 'Zugzwang',
  xRayAttack: 'Attacco a raggi X',
  sacrifice: 'Sacrificio',
  exposedKing: 'Re esposto',
  capturingDefender: 'Cattura del difensore',
  advancedPawn: 'Pedone avanzato',
  promotion: 'Promozione',
  underPromotion: 'Promozione minore',
  enPassant: 'En passant',
  castling: 'Arrocco',
  kingsideAttack: 'Attacco sull’ala di re',
  queensideAttack: 'Attacco sull’ala di donna',
  attackingF2F7: 'Attacco su f2/f7',

  // Origine
  master: 'Partita di maestri',
  masterVsMaster: 'Maestro contro maestro',
  superGM: 'Super Grandi Maestri',
  playerGames: 'Partite di giocatori',
};
