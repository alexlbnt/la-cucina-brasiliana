/** Seções do cardápio, na ordem em que aparecem. Para criar uma nova, acrescente aqui. */
export const CATEGORIAS = ['Massas', 'Arroz', 'Peixes', 'Acompanhamentos', 'Ovos'] as const;

export type Categoria = (typeof CATEGORIAS)[number];
