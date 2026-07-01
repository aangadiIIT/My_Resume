'use strict';

/**
 * Pure function — no I/O, no state.
 * Matches a job description against the candidate's skill set.
 *
 * @param {string} jdText — raw job description text
 * @param {object} skillsData — from cachedResumeData.skills
 * @returns {{ score, total_skills, matched_count, matched, notable_missing,
 *             all_missing_count, category_breakdown, confidence }}
 */
function analyzeJD(jdText, skillsData) {
  const jdLower = jdText.toLowerCase();

  // Build proficiency map (lowercase → level)
  const proficiencyMap = {};
  Object.entries(skillsData.proficiency_levels).forEach(([level, skills]) => {
    skills.forEach(s => { proficiencyMap[s.toLowerCase()] = level; });
  });

  // Helper: test whether a skill appears in the JD text
  function skillInJD(skill) {
    const skillLower = skill.toLowerCase();
    const escaped    = skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startBound = /^[a-z0-9]/i.test(skillLower) ? '(?<![a-z0-9])' : '(?<![a-z])';
    const endBound   = /[a-z0-9]$/i.test(skillLower) ? '(?![a-z0-9])' : '(?![a-z])';
    try {
      return new RegExp(startBound + escaped + endBound, 'i').test(jdLower);
    } catch {
      return jdLower.includes(skillLower);
    }
  }

  // Category labels for display
  const CATEGORY_LABELS = {
    cloud_devops:              'Cloud & DevOps',
    monitoring_observability:  'Monitoring & Observability',
    backend_development:       'Backend Development',
    frontend_development:      'Frontend Development',
    system_design_architecture:'System Design & Architecture',
    automation_tools:          'Automation & CI/CD',
    networking:                'Networking',
    programming_languages:     'Programming Languages',
    ai_and_emerging:           'AI & Emerging Tech',
    soft_skills:               'Soft Skills',
  };

  const matched        = [];
  const missing        = [];
  const seen           = new Set();
  const category_breakdown = [];

  // Process each category independently (preserves category context)
  Object.entries(skillsData.categorized).forEach(([catKey, catSkills]) => {
    const catMatched  = [];
    const catMissing  = [];

    catSkills.forEach(skill => {
      const key = skill.toLowerCase();
      if (seen.has(key)) return;   // deduplicate across categories
      seen.add(key);

      const entry = { skill, level: proficiencyMap[key] || 'intermediate' };
      if (skillInJD(skill)) {
        matched.push(entry);
        catMatched.push(skill);
      } else {
        missing.push(entry);
        catMissing.push(skill);
      }
    });

    if (catSkills.length > 0) {
      category_breakdown.push({
        key:     catKey,
        label:   CATEGORY_LABELS[catKey] || catKey,
        total:   catSkills.length,
        matched: catMatched.length,
        score:   Math.round((catMatched.length / catSkills.length) * 100),
        matched_skills: catMatched,
      });
    }
  });

  const total_skills    = seen.size;
  const matched_count   = matched.length;
  const score           = total_skills > 0 ? Math.round((matched_count / total_skills) * 100) : 0;
  const notableMissing  = missing.filter(s => s.level === 'expert' || s.level === 'advanced');

  // Confidence: how complete is the JD? (word count proxy)
  const wordCount = jdText.trim().split(/\s+/).length;
  const confidence = wordCount >= 200 ? 'high' : wordCount >= 80 ? 'medium' : 'low';

  // Sort category breakdown by matched score descending
  category_breakdown.sort((a, b) => b.score - a.score);

  return {
    score,
    total_skills,
    matched_count,
    matched,
    notable_missing:   notableMissing,
    all_missing_count: missing.length,
    category_breakdown,
    confidence,
    word_count: wordCount,
  };
}

module.exports = { analyzeJD };
