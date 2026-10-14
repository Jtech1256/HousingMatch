// Shapes of the data we get back from the database.

export type Gender = 'man' | 'woman' | 'nonbinary';
export type HousingType = 'on_campus' | 'off_campus' | 'either';

export type Profile = {
  id: string;
  school_domain: string;
  name: string;
  photo_url: string | null;
  bio: string;
  major: string;
  grad_year: number | null;
  gender: Gender;
  roommate_gender_pref: 'same' | 'any';
  housing_type: HousingType;
  preferred_areas: string[];
  budget_min: number;
  budget_max: number;
  move_in: string; // 'YYYY-MM-DD'
  interests: string[];
  quiz: number[] | null;
};

// One card in the swipe deck (returned by the get_candidates function)
export type Candidate = Pick<
  Profile,
  | 'id'
  | 'name'
  | 'photo_url'
  | 'bio'
  | 'major'
  | 'grad_year'
  | 'housing_type'
  | 'preferred_areas'
  | 'budget_min'
  | 'budget_max'
  | 'move_in'
  | 'interests'
> & {
  score: number;
  shared_interests: string[];
  shared_areas: string[];
};

export type Message = {
  id: number;
  match_id: string;
  sender: string;
  body: string;
  created_at: string;
};
