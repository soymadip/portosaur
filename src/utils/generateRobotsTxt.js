const path = require('path');
const fs = require('fs');


function formatRules(rules) {
  if (!Array.isArray(rules) || !rules.length) return '';
  
  let content = '';
  
  rules.forEach(rule => {

    // Default userAgent to '*' if not specified
    const userAgent = rule.userAgent || '*';
    
    content += `User-agent: ${userAgent}\n`;
    
    // Check if root path is explicitly disallowed
    const disallowsRoot = Array.isArray(rule.disallow) && 
      rule.disallow.some(path => path === '/' || path === '/*');
    
    // Process allow directives
    if (Array.isArray(rule.allow) && rule.allow.length > 0) {

      // Use explicitly defined allow rules
      for (const allowPath of rule.allow) {
        content += `Allow: ${allowPath}\n`;
      }

    } else if (!disallowsRoot) {
      content += `Allow: /\n`;
    }
    
    // Process disallow directives
    if (Array.isArray(rule.disallow)) {
      for (const disallowPath of rule.disallow) {
        content += `Disallow: ${disallowPath}\n`;
      }
    }
    
    content += '\n';
  });
  
  return content;
}


module.exports = function() {
  return {
    name: 'generate-robots-txt',
    
    async postBuild({ outDir, siteConfig }) {
      const robotsConfig = siteConfig.customFields?.robotsTxt;
      
      // Early return if robots.txt is disabled
      if (!robotsConfig || robotsConfig.enable === false) {
        console.log('ℹ️ robots.txt generation is disabled in config');
        return;
      }
      
      try {
        const robotsTxtPath = path.join(outDir, 'robots.txt');
        let content = '';
        
        // Process the rules structure
        if (robotsConfig.rules) {
          content += formatRules(robotsConfig.rules);
        }
        
        // Always include sitemap reference
        content += `Sitemap: ${siteConfig.url}/sitemap.xml\n`;
        
        if (Array.isArray(robotsConfig.customLines) && robotsConfig.customLines.length) {

          const filteredCustomLines = robotsConfig.customLines.filter(
            line => !line.trim().toLowerCase().startsWith('sitemap:')
          );
          
          if (filteredCustomLines.length > 0) {
            content += filteredCustomLines.join('\n') + '\n';
          }
        }
        
        // Only write file if we have content
        if (content) {
          fs.writeFileSync(robotsTxtPath, content, 'utf8');
          console.log('✅ robots.txt generated successfully');

        } else {
          console.warn('⚠️ Warning: No robots.txt rules defined in config');
        }

      } catch (error) {
        console.error('❌ Error generating robots.txt:', error);
      }
    }
  };
};