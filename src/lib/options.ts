// Everything users pick from: quiz questions, interests, places.
// Edit these lists freely — the database stores whatever strings you put here.

export type QuizQuestion = {
  question: string;
  low: string; // what answer 1 means
  high: string; // what answer 5 means
};

// IMPORTANT: there must be exactly 8 questions (the database checks this).
// If you change the wording of a question, people's old answers still count
// toward it, so only reword — don't swap in a totally different topic —
// once real users have taken the quiz.
export const QUIZ: QuizQuestion[] = [
  { question: 'When do you usually go to sleep?', low: 'Before 11pm', high: 'After 2am' },
  { question: 'How clean do you keep shared spaces?', low: 'Spotless', high: 'Pretty lived-in' },
  { question: 'How often do you have friends over?', low: 'Almost never', high: 'All the time' },
  { question: 'How much noise is okay at home?', low: 'I need quiet', high: 'Music/TV always on' },
  { question: 'Overnight guests (partners, friends)?', low: 'Never', high: 'Often' },
  { question: 'Sharing food and stuff?', low: 'Keep it separate', high: "What's mine is yours" },
  { question: 'What do you want from a roommate?', low: 'Just a roommate', high: 'A close friend' },
  { question: 'Parties or drinking at home?', low: 'Not my thing', high: 'Most weekends' },
];

export const INTERESTS = [
  'Gym', 'Running', 'Intramurals', 'Hiking', 'Gaming', 'Anime', 'Movies', 'Music',
  'Concerts', 'Cooking', 'Coffee', 'Reading', 'Art', 'Photography', 'Coding',
  'Football games', 'Greek life', 'Faith groups', 'Volunteering', 'Fashion', 'Travel', 'Pets',
];

// Example places for Virginia Tech — swap these for your school.
export const ON_CAMPUS_AREAS = [
  'Upper Quad', 'Lower Quad', 'Prairie Quad', 'Creativity & Innovation District', 'Oak Lane',
];
export const OFF_CAMPUS_AREAS = [
  'The Edge', 'Foxridge', 'Terrace View', 'Collegiate Suites', 'Pheasant Run',
  'Hunters Ridge', 'Downtown Blacksburg', 'Christiansburg',
];

export const GENDER_OPTIONS = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Nonbinary' },
] as const;

export const HOUSING_OPTIONS = [
  { value: 'on_campus', label: 'On campus' },
  { value: 'off_campus', label: 'Off campus' },
  { value: 'either', label: 'Either' },
] as const;

export const HOUSING_LABEL: Record<string, string> = {
  on_campus: 'On campus',
  off_campus: 'Off campus',
  either: 'On or off campus',
};
