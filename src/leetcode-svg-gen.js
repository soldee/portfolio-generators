// generate-svg.js
const fs = require('fs');
const path = require('path');

const USERNAME = process.env.LEETCODE_USERNAME;

const GRAPHQL_QUERY = `
  query getPortfolioLeetCodeStats($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        ranking
      }
      submitStats: submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
      userCalendar {
        streak
        totalActiveDays
      }
      languageProblemCount {
        languageName
        problemsSolved
      }
    }
    userContestRanking(username: $username) {
      rating
      topPercentage
    }
  }
`;

async function fetchLeetCodeStats() {
  const response = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com'
    },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: { username: USERNAME },
      operationName: 'getPortfolioLeetCodeStats'
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}\nResponse: ${errorBody}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(data.errors, null, 2)}`);
  }

  if (!data.data || !data.data.matchedUser) {
    throw new Error(`User "${USERNAME}" not found on LeetCode.`);
  }

  return data.data;
}

function createSVG({ matchedUser, userContestRanking }) {
  const stats = matchedUser.submitStats?.acSubmissionNum || [];
  const getCount = (diff) => stats.find(s => s.difficulty === diff)?.count || 0;

  const total = getCount('All');
  const easy = getCount('Easy');
  const medium = getCount('Medium');
  const hard = getCount('Hard');

  const streak = matchedUser.userCalendar?.streak || 0;
  const activeDays = matchedUser.userCalendar?.totalActiveDays || 0;

  // Format activity text with streak
  const activityText = streak > 0 
    ? `🔥 ${streak} Day Streak · ${activeDays}d Active`
    : `${activeDays} Days Active`;

  const topLangs = (matchedUser.languageProblemCount || [])
    .sort((a, b) => b.problemsSolved - a.problemsSolved)
    .slice(0, 3)
    .map(l => l.languageName)
    .join(' · ') || 'N/A';

  let rankText = 'Unrated';
  if (userContestRanking && userContestRanking.rating) {
    const rating = Math.round(userContestRanking.rating);
    const topPct = userContestRanking.topPercentage 
      ? `Top ${userContestRanking.topPercentage.toFixed(1)}%` 
      : null;
    rankText = topPct ? `${topPct} (${rating.toLocaleString()})` : `Rating: ${rating.toLocaleString()}`;
  } else if (matchedUser.profile?.ranking) {
    rankText = `Global Rank #${matchedUser.profile.ranking.toLocaleString()}`;
  }

  return `<svg width="452" height="232" viewBox="0 0 452 232" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .card { fill: #0d1117; rx: 12px; stroke: #30363d; stroke-width: 1px; }
    .title { font: bold 16px 'Segoe UI', Ubuntu, Roboto, sans-serif; fill: #ffa116; }
    .subhead { font: 13px 'Segoe UI', Ubuntu, Roboto, sans-serif; fill: #8b949e; }
    .label { font: 13px 'Segoe UI', Ubuntu, Roboto, sans-serif; fill: #8b949e; }
    .value { font: bold 14px 'Segoe UI', Ubuntu, Roboto, sans-serif; fill: #f0f6fc; }
    .stat-pill { font: bold 12px 'Segoe UI', Ubuntu, Roboto, sans-serif; }
    .easy { fill: #00b8a3; }
    .medium { fill: #ffc01e; }
    .hard { fill: #ef4743; }
    .divider { stroke: #21262d; stroke-width: 1px; }
  </style>

  <!-- 16px Outer Padding Margin -->
  <g transform="translate(16, 16)">
    <rect width="420" height="200" class="card" />

    <!-- Header -->
    <text x="24" y="38" class="title">LeetCode Stats</text>
    <text x="396" y="38" text-anchor="end" class="subhead">@${matchedUser.username}</text>

    <!-- Rank / Rating & Streak / Active Days -->
    <text x="24" y="66" class="value">${rankText}</text>
    <text x="396" y="66" text-anchor="end" class="subhead">${activityText}</text>

    <line x1="24" y1="82" x2="396" y2="82" class="divider" />

    <!-- Solved Count -->
    <text x="24" y="110" class="label">Total Solved:</text>
    <text x="110" y="110" class="value">${total}</text>

    <!-- Difficulty Pills -->
    <g transform="translate(24, 124)">
      <rect x="0" y="0" width="115" height="26" rx="6" fill="#00b8a3" fill-opacity="0.15" />
      <text x="57" y="17" text-anchor="middle" class="stat-pill easy">Easy ${easy}</text>

      <rect x="123" y="0" width="115" height="26" rx="6" fill="#ffc01e" fill-opacity="0.15" />
      <text x="180" y="17" text-anchor="middle" class="stat-pill medium">Med ${medium}</text>

      <rect x="246" y="0" width="126" height="26" rx="6" fill="#ef4743" fill-opacity="0.15" />
      <text x="309" y="17" text-anchor="middle" class="stat-pill hard">Hard ${hard}</text>
    </g>

    <!-- Languages -->
    <text x="24" y="178" class="label">Top Languages:</text>
    <text x="135" y="178" class="value">${topLangs}</text>
  </g>
</svg>`;
}

async function main() {
  try {
    const data = await fetchLeetCodeStats();
    const svgContent = createSVG(data);
    
    const outputDir = path.resolve(__dirname, '../output');
    const outputPath = path.join(outputDir, 'leetcode-stats.svg');

    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(outputPath, svgContent);
    console.log('Successfully generated leetcode-stats.svg');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();