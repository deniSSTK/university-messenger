const NICKNAME_COLORS = ['BLUE', 'PURPLE', 'GREEN', 'ORANGE', 'PINK', 'RED', 'CYAN'] as const;

type NicknameColor = (typeof NICKNAME_COLORS)[number];

export { NICKNAME_COLORS };
export type { NicknameColor };
