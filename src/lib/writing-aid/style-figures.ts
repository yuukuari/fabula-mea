export interface BeforeAfter {
  before: string;
  after: string;
  comment?: string;
}

export interface StyleFigure {
  name: string;
  shortDef: string;
  longDef: string;
  /** À quoi ça sert, ce que ça apporte au lecteur. */
  purpose: string;
  /** Cas concrets d'emploi en narration. */
  useCases: string[];
  /** Exemples littéraires « bruts ». */
  examples: string[];
  /** Comparaison : la même idée sans / avec la figure. */
  beforeAfter: BeforeAfter[];
}

export const STYLE_FIGURES: StyleFigure[] = [
  {
    name: 'Métaphore',
    shortDef: 'Comparaison sans outil de comparaison.',
    longDef: 'Substitue un terme à un autre par analogie, sans utiliser « comme », « tel », « semblable à ».',
    purpose: 'Crée une image vive, fait ressentir au lieu d\'expliquer. Économise des mots et invite le lecteur à compléter le sens, ce qui le rend complice.',
    useCases: [
      'Décrire une émotion sans la nommer (peur = bête tapie, espoir = lueur).',
      'Caractériser un personnage en deux mots (« cette montagne d\'homme »).',
      'Donner une couleur poétique à un paysage banal.',
    ],
    examples: [
      'Cet homme est un lion.',
      'L\'or de ses cheveux brillait au soleil.',
      'Le matin déversait son lait sur les toits. (Apollinaire)',
    ],
    beforeAfter: [
      {
        before: 'Il était très en colère et son visage était rouge.',
        after: 'Son visage était un brasier.',
        comment: 'L\'image fait sentir la chaleur, la dévoration — la phrase devient un instantané sensoriel.',
      },
      {
        before: 'La ville était silencieuse et inquiétante.',
        after: 'La ville retenait son souffle.',
        comment: 'La personnification métaphorique rend le silence vivant, suggère qu\'il prélude à un événement.',
      },
    ],
  },
  {
    name: 'Comparaison',
    shortDef: 'Rapproche deux éléments par un outil (comme, tel, semblable à).',
    longDef: 'Établit une analogie explicite entre deux termes, marquée par un mot-outil (comme, tel, semblable à, pareil à, ainsi que…).',
    purpose: 'Plus explicite que la métaphore, elle aide le lecteur à visualiser sans ambiguïté. Utile quand l\'image doit être claire sans ralentir.',
    useCases: [
      'Donner une dimension à un objet ou un son.',
      'Caractériser rapidement un mouvement, une voix, une posture.',
      'Glisser un trait de caractère par un parallèle inattendu.',
    ],
    examples: [
      'Il était fort comme un bœuf.',
      'Sa voix, semblable au murmure d\'un ruisseau, l\'apaisa.',
    ],
    beforeAfter: [
      {
        before: 'La porte fit beaucoup de bruit en s\'ouvrant.',
        after: 'La porte gémit comme une bête blessée.',
        comment: 'La comparaison transforme un détail anodin en ambiance sonore et émotive.',
      },
    ],
  },
  {
    name: 'Métonymie',
    shortDef: 'Désigne une chose par un terme qui lui est lié.',
    longDef: 'Remplacement d\'un mot par un autre selon une relation logique : contenant/contenu, cause/effet, partie/tout, auteur/œuvre.',
    purpose: 'Rapide, suggestive : économise des mots, oriente l\'attention sur l\'élément vraiment significatif (le verre plutôt que ce qu\'il contient).',
    useCases: [
      'Suggérer une action sans la décrire entièrement (« lever son verre »).',
      'Désigner une foule par le lieu (« la salle a applaudi »).',
      'Référencer un auteur, un objet symbolique.',
    ],
    examples: [
      'Boire un verre. (le contenu pour le contenant)',
      'Lire un Zola. (l\'auteur pour l\'œuvre)',
      'La salle a applaudi. (le lieu pour les personnes)',
    ],
    beforeAfter: [
      {
        before: 'Tous les spectateurs présents dans la salle ont applaudi.',
        after: 'La salle a applaudi.',
        comment: 'Plus dense, plus rythmé. Le détail superflu disparaît.',
      },
    ],
  },
  {
    name: 'Synecdoque',
    shortDef: 'Cas particulier de métonymie : la partie pour le tout (ou inverse).',
    longDef: 'Désigne le tout par une partie, ou la partie par le tout.',
    purpose: 'Fait sentir l\'objet par un détail saillant. Au cinéma : équivalent du gros plan — le détail qui résume la scène.',
    useCases: [
      'Désigner un bateau par sa voile, un cavalier par sa monture.',
      'Évoquer une foule par un seul élément vu de loin.',
    ],
    examples: [
      'Une voile à l\'horizon. (la voile pour le bateau)',
      'Les Français ont voté. (le tout pour une partie)',
    ],
    beforeAfter: [
      {
        before: 'Au loin, on apercevait un grand bateau qui approchait.',
        after: 'Au loin, une voile.',
        comment: 'La phrase devient un tableau. L\'œil du lecteur fait le travail.',
      },
    ],
  },
  {
    name: 'Anaphore',
    shortDef: 'Répétition d\'un mot ou d\'un groupe en début de phrases successives.',
    longDef: 'Crée un effet d\'insistance, un martèlement rythmique.',
    purpose: 'Imprime une idée, donne une cadence quasi musicale. Utile dans les discours, les passages d\'émotion intense, ou pour structurer une énumération mémorable.',
    useCases: [
      'Climax émotionnel (déclaration d\'amour, colère, prière).',
      'Discours d\'un personnage charismatique.',
      'Ouverture de paragraphes pour rythmer un développement.',
    ],
    examples: [
      'Moi président, je serai... Moi président, je ne... Moi président, je veillerai...',
      'Rome, l\'unique objet de mon ressentiment ! / Rome, à qui vient ton bras d\'immoler mon amant ! (Corneille)',
    ],
    beforeAfter: [
      {
        before: 'Je me souviens de son rire, de son parfum et de ses silences.',
        after: 'Je me souviens de son rire. Je me souviens de son parfum. Je me souviens de ses silences.',
        comment: 'L\'anaphore transforme une simple liste en litanie — chaque souvenir prend du poids.',
      },
    ],
  },
  {
    name: 'Énumération',
    shortDef: 'Suite de termes coordonnés ou juxtaposés.',
    longDef: 'Accumule des éléments pour amplifier ou détailler.',
    purpose: 'Crée un sentiment d\'abondance, de chaos, de richesse — selon le rythme. La fin de l\'énumération (ironique, surprenante) peut renverser tout l\'effet.',
    useCases: [
      'Décrire une foule, un marché, un désordre.',
      'Surprendre par le dernier élément (rupture humoristique).',
      'Suggérer la fatigue, l\'accumulation des tâches.',
    ],
    examples: [
      'Adieu, veau, vache, cochon, couvée. (La Fontaine)',
      'Il prit son chapeau, son manteau, sa canne, son sourire — et sortit.',
    ],
    beforeAfter: [
      {
        before: 'Le marché était bondé et coloré.',
        after: 'Étals de tomates, cris des marchands, odeurs de pain chaud, mains tendues, monnaie qui tinte — le marché vivait.',
        comment: 'L\'énumération fait éprouver la densité plutôt que la nommer.',
      },
    ],
  },
  {
    name: 'Asyndète',
    shortDef: 'Suppression des liens logiques entre les termes.',
    longDef: 'Juxtaposition sans conjonction, qui accélère le rythme.',
    purpose: 'Imprime de la vitesse, de l\'urgence, de la fatalité. Idéal pour une scène d\'action ou un constat lapidaire.',
    useCases: [
      'Scène d\'action rapide (combat, fuite).',
      'Conclusion sèche, sentence, verdict.',
      'Trois étapes d\'une vie résumées en trois mots.',
    ],
    examples: [
      'Je vis, je vins, je vainquis. (Veni, vidi, vici)',
      'Il entra, regarda, sortit.',
    ],
    beforeAfter: [
      {
        before: 'Il est entré dans la pièce, puis il a regardé autour de lui, et finalement il est sorti.',
        after: 'Il entra, regarda, sortit.',
        comment: 'Le rythme staccato fait sentir la décision, l\'absence d\'hésitation.',
      },
    ],
  },
  {
    name: 'Polysyndète',
    shortDef: 'Multiplication des conjonctions de coordination.',
    longDef: 'L\'inverse de l\'asyndète : une conjonction (souvent « et ») répétée pour ralentir et appuyer.',
    purpose: 'Ralentit la lecture, donne une impression d\'accumulation lente, d\'éternité. Évoque la mer, l\'enfance, la lassitude.',
    useCases: [
      'Souvenir contemplatif, paysage qui s\'étire.',
      'Saturation émotionnelle (trop, trop, trop).',
    ],
    examples: [
      'Et la mer, et le sable, et le ciel...',
    ],
    beforeAfter: [
      {
        before: 'La mer, le sable et le ciel se confondaient.',
        after: 'Et la mer, et le sable, et le ciel se confondaient.',
        comment: 'Le « et » répété donne une houle régulière, contemplative.',
      },
    ],
  },
  {
    name: 'Chiasme',
    shortDef: 'Disposition croisée AB / BA.',
    longDef: 'Inverse l\'ordre des termes dans la seconde partie pour produire un effet de symétrie.',
    purpose: 'Frappe par sa symétrie, marque une formule mémorable. Excellent pour clore un paragraphe ou souligner une vérité paradoxale.',
    useCases: [
      'Maxime, aphorisme, conclusion mémorable.',
      'Souligner une opposition ou un retournement.',
    ],
    examples: [
      'Il faut manger pour vivre et non vivre pour manger. (Molière)',
      'Un roi chantait en bas, en haut mourait un dieu. (Hugo)',
    ],
    beforeAfter: [
      {
        before: 'On vit pour travailler et on travaille pour vivre.',
        after: 'On travaille pour vivre, et non l\'inverse — vivre pour travailler.',
        comment: 'Le chiasme donne du relief à l\'opposition et la rend retenue par cœur.',
      },
    ],
  },
  {
    name: 'Oxymore',
    shortDef: 'Rapprochement de deux termes contradictoires.',
    longDef: 'Crée une tension paradoxale et expressive.',
    purpose: 'Saisit le lecteur par le paradoxe : deux mots qui ne devraient pas aller ensemble révèlent une vérité plus subtile que chacun pris seul.',
    useCases: [
      'Décrire une émotion ambivalente (joie triste, colère tendre).',
      'Rendre la singularité d\'une atmosphère ou d\'un personnage.',
    ],
    examples: [
      'Cette obscure clarté qui tombe des étoiles. (Corneille)',
      'Un silence assourdissant.',
    ],
    beforeAfter: [
      {
        before: 'Le silence dans la pièce était très lourd.',
        after: 'Un silence assourdissant régnait dans la pièce.',
        comment: 'L\'oxymore exprime le poids du silence mieux qu\'un adjectif d\'intensité.',
      },
    ],
  },
  {
    name: 'Antithèse',
    shortDef: 'Opposition de deux idées dans une même phrase.',
    longDef: 'Met en parallèle deux notions contraires pour les souligner.',
    purpose: 'Met en relief par contraste. La phrase devient claire, tranchée, mémorable.',
    useCases: [
      'Décrire un personnage tiraillé.',
      'Conclure sur un constat percutant.',
      'Opposer deux mondes, deux époques.',
    ],
    examples: [
      'La nature est grande dans les petites choses. (Buffon)',
      'Je vis, je meurs ; je me brûle et me noie. (Louise Labé)',
    ],
    beforeAfter: [
      {
        before: 'Il était à la fois fort et fragile.',
        after: 'Sa force le rendait fragile.',
        comment: 'L\'antithèse transforme une description plate en paradoxe vivant.',
      },
    ],
  },
  {
    name: 'Hyperbole',
    shortDef: 'Exagération expressive.',
    longDef: 'Amplifie pour frapper l\'imagination.',
    purpose: 'Donne du relief à une émotion, fait sentir l\'intensité plutôt que la décrire. Attention à la dose : l\'hyperbole banalisée perd tout effet.',
    useCases: [
      'Voix d\'un personnage passionné, exalté.',
      'Tonalité comique ou tragique.',
      'Marquer un instant d\'exception.',
    ],
    examples: [
      'Mourir de rire.',
      'Je te l\'ai dit mille fois.',
    ],
    beforeAfter: [
      {
        before: 'J\'avais vraiment très faim.',
        after: 'J\'aurais dévoré un bœuf.',
        comment: 'L\'image grossie fait sentir la faim ; le procédé est aussi un trait de voix.',
      },
    ],
  },
  {
    name: 'Litote',
    shortDef: 'Dire moins pour suggérer plus.',
    longDef: 'Atténue l\'expression pour suggérer une idée plus forte. Souvent à la forme négative.',
    purpose: 'Crée de la pudeur, de la retenue, parfois de l\'ironie. Plus puissant que l\'affirmation directe parce que le lecteur fait le chemin.',
    useCases: [
      'Déclaration d\'amour pudique.',
      'Compliment réservé, élégance bourgeoise.',
      'Ironie, sous-entendu.',
    ],
    examples: [
      'Ce n\'est pas mauvais. (= c\'est très bon)',
      'Va, je ne te hais point. (Corneille — = je t\'aime)',
    ],
    beforeAfter: [
      {
        before: 'Je t\'aime passionnément.',
        after: 'Je ne te hais point.',
        comment: 'L\'aveu pudique, contenu, dit plus que la déclaration directe — c\'est tout l\'art de Corneille ici.',
      },
    ],
  },
  {
    name: 'Personnification',
    shortDef: 'Attribuer des traits humains à un objet, une idée, un animal.',
    longDef: 'Donne vie à l\'inanimé.',
    purpose: 'Anime le décor, le rend complice ou hostile. Le monde devient acteur, pas simple toile de fond.',
    useCases: [
      'Atmosphères inquiétantes (la maison qui guette).',
      'Décor poétique (le vent qui chuchote).',
      'Symboliser une émotion par un élément naturel.',
    ],
    examples: [
      'Le vent murmurait à l\'oreille des arbres.',
      'La ville dort.',
    ],
    beforeAfter: [
      {
        before: 'Le vent soufflait dans les arbres.',
        after: 'Le vent murmurait à l\'oreille des arbres.',
        comment: 'La scène devient intime, presque amoureuse — le décor a un secret.',
      },
    ],
  },
  {
    name: 'Allitération',
    shortDef: 'Répétition de consonnes proches.',
    longDef: 'Effet sonore par le retour d\'un même son consonantique.',
    purpose: 'Joue sur le sens par le son : sifflantes pour le mystère ou le serpent, dentales pour la dureté, labiales pour la douceur.',
    useCases: [
      'Atmosphère sonore d\'un passage descriptif.',
      'Renforcement d\'un sentiment (peur, calme, violence).',
      'Phrase qu\'on veut faire « sonner ».',
    ],
    examples: [
      'Pour qui sont ces serpents qui sifflent sur vos têtes ? (Racine)',
    ],
    beforeAfter: [
      {
        before: 'Le serpent glissait silencieusement sur les pierres.',
        after: 'Le serpent silencieux scintillait sur les pierres.',
        comment: 'Les sifflantes font entendre le glissement même quand on lit en silence.',
      },
    ],
  },
  {
    name: 'Assonance',
    shortDef: 'Répétition de voyelles.',
    longDef: 'Pendant vocalique de l\'allitération.',
    purpose: 'Donne une couleur sonore au passage : voyelles ouvertes pour la grandeur, fermées pour l\'intime.',
    useCases: [
      'Passages lyriques, presque chantés.',
      'Insistance émotionnelle douce.',
    ],
    examples: [
      'Tout m\'afflige et me nuit, et conspire à me nuire. (Racine)',
    ],
    beforeAfter: [
      {
        before: 'Tout me fait mal et me déchire.',
        after: 'Tout m\'afflige et me nuit, et conspire à me nuire.',
        comment: 'Les « i » répétés grincent — la souffrance s\'entend.',
      },
    ],
  },
  {
    name: 'Gradation',
    shortDef: 'Suite de termes d\'intensité croissante (ou décroissante).',
    longDef: 'Progression contrôlée vers un climax (ou un anti-climax).',
    purpose: 'Construit une montée d\'intensité — le lecteur sent le crescendo. Très efficace en fin de paragraphe ou de scène.',
    useCases: [
      'Climax émotionnel ou narratif.',
      'Effet comique par anti-climax (chute déceptive).',
      'Discours qui veut convaincre.',
    ],
    examples: [
      'Va, cours, vole, et nous venge ! (Corneille)',
      'C\'est un roc !... c\'est un pic !... c\'est un cap ! Que dis-je, c\'est un cap ?... C\'est une péninsule ! (Rostand)',
    ],
    beforeAfter: [
      {
        before: 'Pars vite et venge-nous.',
        after: 'Va, cours, vole, et nous venge !',
        comment: 'Trois verbes en gradation montent vers l\'ordre final ; le lecteur ressent l\'urgence.',
      },
    ],
  },
  {
    name: 'Zeugma',
    shortDef: 'Association de termes hétérogènes par un même mot.',
    longDef: 'Lie un sens concret et un sens abstrait par une seule construction.',
    purpose: 'Effet de surprise, souvent comique ou poétique. Brise la routine syntaxique en accolant deux registres.',
    useCases: [
      'Trait d\'humour pince-sans-rire.',
      'Caractérisation rapide et acérée d\'un personnage.',
    ],
    examples: [
      'Vêtu de probité candide et de lin blanc. (Hugo)',
      'Il prit son chapeau et la fuite.',
    ],
    beforeAfter: [
      {
        before: 'Il prit son chapeau et il s\'enfuit.',
        after: 'Il prit son chapeau et la fuite.',
        comment: 'Le verbe unique attelle le concret et l\'abstrait — la phrase devient drôle et compacte.',
      },
    ],
  },
  {
    name: 'Hypallage',
    shortDef: 'Attribution à un mot d\'un trait qui appartient logiquement à un autre.',
    longDef: 'Déplace l\'épithète sur un objet voisin.',
    purpose: 'Crée une étrangeté élégante, fait porter par un objet ce qui est en réalité dans le personnage. Très utilisé en poésie.',
    useCases: [
      'Effet stylistique discret pour une description.',
      'Suggérer un état d\'âme par le décor.',
    ],
    examples: [
      'Ce marchand accoudé sur son comptoir avide. (Hugo — l\'avidité est du marchand)',
    ],
    beforeAfter: [
      {
        before: 'Le marchand avide était accoudé sur son comptoir.',
        after: 'Le marchand accoudé sur son comptoir avide.',
        comment: 'L\'avidité contamine l\'objet — l\'image devient surprenante, plus dense.',
      },
    ],
  },
  {
    name: 'Prétérition',
    shortDef: 'Annoncer qu\'on ne va pas dire ce qu\'on est en train de dire.',
    longDef: 'Feint d\'omettre ce qu\'on évoque pourtant.',
    purpose: 'Permet de tout dire sans avoir l\'air d\'attaquer frontalement. Très utile en rhétorique politique ou dans une joute verbale.',
    useCases: [
      'Discours d\'un personnage hypocrite ou rusé.',
      'Critique voilée, ironie.',
      'Listes que l\'on prétend escamoter.',
    ],
    examples: [
      'Je ne parlerai pas de sa lâcheté, ni de sa cruauté, ni de ses mensonges...',
    ],
    beforeAfter: [
      {
        before: 'Il est lâche, cruel, et menteur.',
        after: 'Je ne parlerai pas de sa lâcheté, ni de sa cruauté, ni de ses mensonges.',
        comment: 'La prétérition habille l\'attaque d\'élégance — le coup porte plus loin parce qu\'il a l\'air retenu.',
      },
    ],
  },
];
