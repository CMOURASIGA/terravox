import type { SourcedQuestion } from './questionSource';

// Original offline set for the ten Brazil campaign checkpoints.
const trail: Array<[string, string, string, string, string, string]> = [
  ['O que as raízes das árvores ajudam a proteger nas margens dos rios?', 'O solo contra a erosão', 'A água contra as marés', 'O céu contra as nuvens', 'As rochas contra a gravidade', 'As raízes ajudam a manter o solo no lugar.'],
  ['Qual animal pode transportar pólen enquanto procura néctar?', 'Beija-flor', 'Tatu', 'Capivara', 'Onça-pintada', 'O pólen pode aderir às penas e chegar à próxima flor.'],
  ['Qual atitude ajuda a preservar uma nascente?', 'Manter a vegetação ao redor', 'Retirar todas as raízes', 'Depositar entulho na margem', 'Desviar todo o curso da água', 'A vegetação protege o solo e ajuda a conservar a água.'],
  ['Em um mapa, qual elemento explica o significado dos símbolos?', 'Legenda', 'Moldura', 'Título do livro', 'Número da página', 'A legenda explica os símbolos usados na representação.'],
  ['O que acontece com parte da água da chuva ao penetrar no solo?', 'Ela pode abastecer águas subterrâneas', 'Ela deixa de fazer parte do ciclo da água', 'Ela sempre vira gelo', 'Ela se transforma em areia', 'A infiltração pode contribuir para a recarga de aquíferos.'],
  ['Qual grupo de seres vivos ajuda a decompor folhas caídas?', 'Fungos e bactérias', 'Aves de rapina', 'Peixes de água salgada', 'Grandes felinos', 'A decomposição devolve nutrientes ao ambiente.'],
  ['Qual instrumento indica direções usando o campo magnético da Terra?', 'Bússola', 'Termômetro', 'Pluviômetro', 'Cronômetro', 'A agulha imantada se orienta pelo campo magnético terrestre.'],
  ['Qual é a principal fonte de energia para a fotossíntese na floresta?', 'Luz do Sol', 'Som dos animais', 'Vento entre as folhas', 'Calor das rochas', 'A planta utiliza a energia da luz para produzir açúcares.'],
  ['Qual é a função de um corredor de vegetação entre duas áreas de mata?', 'Facilitar o deslocamento de animais', 'Impedir toda a polinização', 'Eliminar os cursos de água', 'Separar todas as populações', 'Áreas conectadas permitem que animais circulem entre fragmentos de mata.'],
  ['Uma seta aponta para o norte no mapa. Qual direção fica no sentido oposto?', 'Sul', 'Leste', 'Oeste', 'Nordeste', 'Norte e sul são direções opostas.'],
];

export function brazilTrailQuestions(): SourcedQuestion[] {
  return trail.map(([prompt, answer, b, c, d, explanation], index) => {
    const options = [b, c, d];
    options.splice((index * 3 + 1) % 4, 0, answer);
    return { id: 'brasil-trilha-' + index, source: 'local', prompt, options, correct_answer: answer, explanation };
  });
}
