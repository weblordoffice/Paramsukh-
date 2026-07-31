const WELLNESS_BOOSTS = {
  stress:    { threshold: 7, direction: 'gte', addCategories: ['mental', 'spiritual'], tags: ['meditation','calm','relax','stress','mindfulness','breath'], weight: 5 },
  sleep:     { threshold: 4, direction: 'lte', addCategories: ['spiritual', 'mental'], tags: ['sleep','relax','calm','rest','yoga nidra'], weight: 5 },
  energy:    { threshold: 4, direction: 'lte', addCategories: ['physical'], tags: ['energy','vitality','prana','breath'], weight: 4 },
  mood:      { threshold: 4, direction: 'lte', addCategories: ['mental', 'spiritual'], tags: ['mood','joy','happiness','gratitude','positive'], weight: 4 },
};

const ACTIVITY_MATCH = {
  sedentary_light: { indicators: ['beginner','gentle','intro','foundation','basic'], weight: 4 },
  active_intense:  { indicators: ['advanced','intensive','challenging','power'], weight: 3 },
};
const AGE_SENIOR = { threshold: 50, indicators: ['gentle','senior','restorative','chair'], weight: 3 };

export const deriveCategoriesAndIssues = (assessment, mappings) => {
  const categories = new Set();
  const issues = [];
  const keys = ['physicalIssue','specialDiseaseIssue','mentalHealthIssue','relationshipIssue','financialIssue','spiritualGrowth'];

  for (const key of keys) {
    if (assessment[key] !== true) continue;
    const map = (mappings && mappings[key]) || null;
    if (!map) continue;
    categories.add(map.category);
    (map.secondaryCategories || []).forEach(c => categories.add(c));
    issues.push({
      key, category: map.category,
      details: assessment[key + 'Details'] || '',
      template: map.template,
      priorityTags: (map.priorityTags || []).map(t => t.toLowerCase()),
    });
  }

  const s = assessment.stressLevel || 5, sl = assessment.sleepQuality || 5, e = assessment.energyLevel || 5, m = assessment.moodRating || 5;
  for (const [name, cfg] of Object.entries(WELLNESS_BOOSTS)) {
    const val = { stress: s, sleep: sl, energy: e, mood: m }[name];
    const triggered = cfg.direction === 'gte' ? val >= cfg.threshold : val <= cfg.threshold;
    if (triggered) cfg.addCategories.forEach(c => categories.add(c));
  }

  return { categories: [...categories], issues };
};

export const scoreCourse = (course, { categories, issues, assessment, userTags = [] }) => {
  let score = 0;
  const courseTags = (course.tags || []).map(t => t.toLowerCase());
  const category = course.category || '';

  const primaryIssue = issues.find(i => i.category === category);
  if (primaryIssue) {
    score += 10;
    const matching = primaryIssue.priorityTags.filter(pt =>
      courseTags.some(ct => ct.includes(pt) || pt.includes(ct)));
    score += matching.length * 4;
  } else if (categories.includes(category)) {
    score += 6;
  }

  const s = assessment.stressLevel || 5, sl = assessment.sleepQuality || 5, e = assessment.energyLevel || 5, m = assessment.moodRating || 5;
  for (const [name, cfg] of Object.entries(WELLNESS_BOOSTS)) {
    const val = { stress: s, sleep: sl, energy: e, mood: m }[name];
    if (cfg.direction === 'gte' ? val >= cfg.threshold : val <= cfg.threshold) {
      if (courseTags.some(t => cfg.tags.some(k => t.includes(k)))) score += cfg.weight;
    }
  }

  const pal = assessment.physicalActivityLevel || 'moderate';
  if (pal === 'sedentary' || pal === 'light') {
    if (courseTags.some(t => ACTIVITY_MATCH.sedentary_light.indicators.some(k => t.includes(k)))) score += ACTIVITY_MATCH.sedentary_light.weight;
  } else if (pal === 'active' || pal === 'very_active') {
    if (courseTags.some(t => ACTIVITY_MATCH.active_intense.indicators.some(k => t.includes(k)))) score += ACTIVITY_MATCH.active_intense.weight;
  }

  const age = assessment.birthDate
    ? Math.floor((Date.now() - new Date(assessment.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 30;
  if (age > AGE_SENIOR.threshold) {
    if (courseTags.some(t => AGE_SENIOR.indicators.some(k => t.includes(k)))) score += AGE_SENIOR.weight;
  }

  if (userTags.length > 0 && courseTags.some(t => userTags.includes(t))) score += 6;

  return score;
};
