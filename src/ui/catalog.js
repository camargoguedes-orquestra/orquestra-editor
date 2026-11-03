/** Catálogos de conteúdo do editor: emojis frequentes, símbolos e modelos de documento. */

export const FREQUENT_EMOJIS = [
  ['😀', 'sorriso'], ['😃', 'feliz'], ['😄', 'alegre'], ['😁', 'sorrindo'], ['😆', 'risada'], ['😅', 'suor'], ['😂', 'rindo'],
  ['🤣', 'gargalhada'], ['😊', 'sorrindo'], ['😇', 'anjo'], ['🙂', 'leve'], ['🙃', 'invertido'], ['😉', 'piscada'], ['😍', 'apaixonado'],
  ['🥰', 'amor'], ['😘', 'beijo'], ['😋', 'delicioso'], ['😎', 'óculos'], ['🤔', 'pensando'], ['🤩', 'maravilhado'], ['🥳', 'festa'],
  ['😢', 'triste'], ['😭', 'chorando'], ['😡', 'bravo'], ['🤯', 'surpreso'], ['🤗', 'abraço'], ['😴', 'sono'], ['🤓', 'inteligente'],
  ['🧐', 'análise'], ['😷', 'máscara'], ['🤝', 'acordo'], ['👍', 'positivo'], ['👎', 'negativo'], ['👏', 'aplausos'], ['🙌', 'celebração'],
  ['🙏', 'obrigado'], ['💪', 'força'], ['👋', 'olá'], ['👀', 'olhos'], ['❤️', 'amor coração'], ['💚', 'verde'], ['💙', 'azul'],
  ['💛', 'amarelo'], ['💜', 'roxo'], ['✨', 'brilho'], ['⭐', 'estrela'], ['🔥', 'fogo'], ['🎉', 'comemoração'], ['🎂', 'bolo aniversário'],
  ['🎁', 'presente'], ['🎯', 'alvo meta'], ['🚀', 'foguete'], ['💡', 'ideia'], ['📌', 'pin fixar'], ['📅', 'agenda calendário'],
  ['📊', 'gráfico'], ['📝', 'anotações'], ['📄', 'documento'], ['📚', 'livros'], ['✅', 'certo feito'], ['❌', 'erro'], ['⚠️', 'alerta atenção'],
  ['💰', 'dinheiro'], ['💳', 'cartão'], ['🏦', 'banco'], ['🏢', 'prédio condomínio'], ['🏠', 'casa'], ['🔑', 'chave'], ['🚗', 'carro garagem'],
  ['🧹', 'limpeza'], ['🔧', 'manutenção'], ['💧', 'água'], ['⚡', 'energia raio'], ['🦷', 'dente'], ['🩺', 'saúde'], ['💻', 'computador'],
  ['📱', 'celular'], ['🔒', 'seguro'], ['🔍', 'buscar'], ['⚙️', 'configuração'], ['📷', 'câmera'], ['🎵', 'música'], ['🌎', 'mundo'],
  ['☀️', 'sol'], ['🌧️', 'chuva'], ['🌹', 'rosa'], ['🐶', 'cachorro'], ['🐱', 'gato'], ['☕', 'café'], ['🍕', 'pizza'], ['🍀', 'sorte'], ['🏆', 'troféu'],
];

export const SYMBOL_GROUPS = {
  'Comuns': '© ® ™ § ¶ † ‡ • · … ‰ ‱ ° º ª № ℮',
  'Moedas': '€ £ ¥ $ ¢ ₹ ₽ ₩ ₿ ₣ ₤ ₺',
  'Matemática': '± × ÷ ≠ ≈ ≡ ≤ ≥ ∞ √ ∛ ∑ ∏ ∫ ∂ ∆ ∇ ∈ ∉ ∩ ∪ ⊂ ⊃ ∀ ∃ ∅ ¬ ∧ ∨ ½ ⅓ ⅔ ¼ ¾ ⅛ ¹ ² ³ ⁴ ₀ ₁ ₂ ₃',
  'Grego': 'α β γ δ ε ζ η θ ι κ λ μ ν ξ π ρ σ τ υ φ χ ψ ω Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω',
  'Setas': '← → ↑ ↓ ↔ ↕ ⇐ ⇒ ⇑ ⇓ ⇔ ↩ ↪ ➜ ➔ ⟵ ⟶',
  'Marcadores': '✓ ✔ ✕ ✗ ★ ☆ ● ○ ◆ ◇ ■ □ ▲ △ ▼ ▽ ♠ ♥ ♦ ♣ ☐ ☑ ☒',
  'Pontuação': '“ ” ‘ ’ « » ‹ › – — ¡ ¿ ‽ ⁂',
};

export const TEMPLATES = {
  comunicado: {
    label: 'Comunicado',
    html: '<h2>Comunicado</h2><p><strong>Assunto:</strong> Informe o assunto</p><p>Prezados(as),</p><p>Insira o texto do comunicado.</p><p>Atenciosamente,</p><p>[Responsável]</p>',
  },
  oficio: {
    label: 'Ofício',
    html: '<h2 style="text-align:center">OFÍCIO Nº [NÚMERO]/[ANO]</h2><p style="text-align:right">[Cidade], [Data]</p><p><strong>Ao(À):</strong> [Destinatário]</p><p><strong>Assunto:</strong> [Assunto]</p><p>Senhor(a),</p><p>Insira o conteúdo.</p><p>Atenciosamente,</p><p>[Nome e função]</p>',
  },
  ata: {
    label: 'Ata de reunião',
    html: '<h2>ATA DE REUNIÃO</h2><p><strong>Data:</strong> [Data] &nbsp; <strong>Local:</strong> [Local]</p><p><strong>Participantes:</strong> [Nomes]</p><h3>Pauta</h3><ol><li><p>Assunto 1</p></li></ol><h3>Deliberações</h3><p>[Registrar]</p><h3>Encaminhamentos</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Responsável — prazo</p></li></ul>',
  },
  contrato: {
    label: 'Contrato',
    html: '<h2 style="text-align:center">CONTRATO</h2><p><strong>CONTRATANTE:</strong> [Nome]</p><p><strong>CONTRATADO:</strong> [Nome]</p><h3>CLÁUSULA PRIMEIRA — DO OBJETO</h3><p>[Descrever]</p><h3>CLÁUSULA SEGUNDA — DAS CONDIÇÕES</h3><p>[Descrever]</p><h3>CLÁUSULA TERCEIRA — DO FORO</h3><p>[Descrever]</p><p style="text-align:center">[Cidade], [Data]</p>',
  },
  convocacao: {
    label: 'Edital de convocação',
    html: '<h2 style="text-align:center">EDITAL DE CONVOCAÇÃO</h2><p>Ficam convocados os(as) senhores(as) condôminos(as) para a Assembleia Geral [Ordinária/Extraordinária], a realizar-se em [data], às [hora] em primeira convocação e às [hora] em segunda convocação, no [local], para deliberar sobre a seguinte ordem do dia:</p><ol><li><p>[Item 1]</p></li><li><p>[Item 2]</p></li></ol><p>[Cidade], [Data].</p><p style="text-align:center">[Síndico(a)]</p>',
  },
  recibo: {
    label: 'Recibo',
    html: '<h2 style="text-align:center">RECIBO</h2><p>Recebi de <strong>[Nome]</strong> a importância de <strong>R$ [valor]</strong> ([valor por extenso]), referente a [descrição].</p><p style="text-align:right">[Cidade], [Data]</p><p style="text-align:center">______________________________<br>[Nome e documento]</p>',
  },
};

export const FONT_FAMILIES = [
  ['', 'Fonte padrão'], ['Arial, sans-serif', 'Arial'], ['Georgia, serif', 'Georgia'], ['Verdana, sans-serif', 'Verdana'],
  ['Tahoma, sans-serif', 'Tahoma'], ['"Times New Roman", serif', 'Times New Roman'], ['"Courier New", monospace', 'Courier New'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet MS'], ['Garamond, serif', 'Garamond'], ['system-ui, sans-serif', 'Sistema'],
];

export const FONT_SIZES = ['', '10px', '12px', '13px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '60px', '72px'];

export const LINE_HEIGHTS = ['', '1', '1.15', '1.5', '1.75', '2', '2.5', '3'];

export const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff',
  '#b91c1c', '#dc2626', '#ea580c', '#f59e0b', '#16a34a', '#0d9488',
  '#0284c7', '#2563eb', '#4f46e5', '#7c3aed', '#c026d3', '#db2777',
  '#fee2e2', '#ffedd5', '#fef3c7', '#dcfce7', '#dbeafe', '#ede9fe',
];

export const CODE_LANGUAGES = [
  ['', 'Detectar automaticamente'], ['plaintext', 'Texto'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'],
  ['php', 'PHP'], ['python', 'Python'], ['java', 'Java'], ['csharp', 'C#'], ['cpp', 'C++'], ['go', 'Go'], ['rust', 'Rust'],
  ['sql', 'SQL'], ['xml', 'HTML/XML'], ['css', 'CSS'], ['json', 'JSON'], ['bash', 'Shell'], ['yaml', 'YAML'], ['markdown', 'Markdown'],
];
