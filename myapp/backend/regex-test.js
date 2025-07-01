// regex-test.js - Parameter Replacement Test

function testParameterReplacement() {
    console.log('🧪 Testing Parameter Replacement...\n');

    const testQuery = `MATCH (p:person)
                      RETURN id(p) as vertex_id,
                             p.id as entity_id,
                             p.name,
                             p.birth_date,
                             p.death_date,
                             p.gender,
                             p.description
                      LIMIT $limit`;

    const params = { limit: 5 };

    console.log('Original Query:');
    console.log(testQuery);
    console.log('\nParameters:', params);

    // Test verschiedene Regex-Varianten
    const regexTests = [
        {
            name: 'Current (broken)',
            regex: new RegExp(`\\$limit\\b`, 'g'),
            replacement: '5'
        },
        {
            name: 'Fixed simple',
            regex: /\$limit\b/g,
            replacement: '5'
        },
        {
            name: 'More robust',
            regex: /\$limit(?!\w)/g,
            replacement: '5'
        }
    ];

    regexTests.forEach(test => {
        let processedQuery = testQuery;
        processedQuery = processedQuery.replace(test.regex, test.replacement);

        console.log(`\n${test.name}:`);
        console.log('Result:', processedQuery.includes('LIMIT 5') ? '✅ SUCCESS' : '❌ FAILED');
        console.log('Query snippet:', processedQuery.substring(processedQuery.indexOf('LIMIT')));
    });

    // Test the complete function
    console.log('\n🔧 Testing Complete Function:');

    let processedQuery = testQuery;
    for (const [key, value] of Object.entries(params)) {
        const paramPlaceholder = /\$limit\b/g;
        const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
        processedQuery = processedQuery.replace(paramPlaceholder, numValue.toString());
    }

    console.log('Final Result:', processedQuery.includes('LIMIT 5') ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Final Query:');
    console.log(processedQuery);
}

if (require.main === module) {
    testParameterReplacement();
}

module.exports = testParameterReplacement;