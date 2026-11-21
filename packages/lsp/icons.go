package main

import (
	"strings"
)

// Icon id validation, mirroring the build-time icon scan
// (core `lib/icon-scan.ts`) and the runtime resolver (core
// `lib/site-icons.ts`): the editor warns about exactly what the
// build warns about, and stays quiet about the values the site
// renders another way.
//
// A value renders as something other than an icon when it is
// raw SVG, an image path or URL, or an emoji — those are never
// warned about. A bare word is a techMap name (react, python,
// guide, ...) or malformed. A value with a colon must be exactly
// `prefix:name` with a known prefix and a non-empty name.
//
// v1 checks the prefix only: whether the name exists in the
// pack (the scan's "Icon not found" warning) needs the Iconify
// pack data in the server, which is a follow-up.

// The usable icon prefixes: the canonical pack names from core
// `lib/iconPrefixes.ts` plus their shorthands.
var validIconPrefixes = map[string]bool{
	"lucide": true, "lu": true,
	"octicon": true, "oc": true,
	"simple-icons": true, "si": true,
	"logos": true, "lo": true,
	"mdi": true, "md": true,
	"line-md": true, "ml": true,
	"devicon": true, "di": true,
	"streamline-sharp": true, "sl": true,
	"fa7-solid": true, "fa": true, "fas": true,
}

// The bare words the site maps to icons (core
// `lib/techmap.ts`, keys lowercased). A snapshot: keep it in
// sync with that file when names are added or removed.
var techMapNames = map[string]bool{
	"react": true, "reactjs": true, "javascript": true, "js": true,
	"typescript": true, "ts": true, "python": true, "py": true,
	"node": true, "nodejs": true, "html": true, "css": true,
	"git": true, "linux": true, "docker": true, "java": true,
	"cpp": true, "csharp": true, "go": true, "rust": true,
	"ruby": true, "php": true, "sql": true, "mysql": true,
	"postgres": true, "mongodb": true, "aws": true, "bash": true,
	"terminal": true, "vue": true, "angular": true, "nextjs": true,
	"kubernetes": true, "tailwind": true, "graphql": true,
	"redis": true, "guide": true, "tutorial": true, "about": true,
	"blog": true, "getting-started": true, "setup": true,
	"faq": true, "features": true, "contact": true,
	"portfolio": true, "home": true, "machine-learning": true,
	"ml": true, "economics": true, "dbms": true,
	"entrepreneurship": true, "data-mining": true,
	"warehouse": true, "github": true, "gitlab": true,
	"mail": true, "email": true, "anilist": true, "linkedin": true,
	"telegram": true, "twitter": true, "x": true, "discord": true,
	"instagram": true, "facebook": true, "youtube": true,
	"tiktok": true, "reddit": true, "twitch": true,
	"pinterest": true, "snapchat": true, "whatsapp": true,
	"spotify": true, "medium": true, "dribbble": true,
	"behance": true,
}

// validateIconID checks one icon value the way the icon scan
// does. It returns "" when the value is fine (or renders as
// something else), and a warning message when it is not.
func validateIconID(value string) string {
	if value == "" {
		return ""
	}
	if strings.HasPrefix(strings.TrimSpace(value), "<svg") {
		return ""
	}
	if strings.Contains(value, ".") || strings.Contains(value, "/") {
		return ""
	}
	if !strings.Contains(value, ":") {
		// No colon: an emoji, a techMap name, or malformed.
		// Go has no Emoji property table; emoji are all
		// non-ASCII, so any non-ASCII rune counts as one.
		for _, r := range value {
			if r > 127 {
				return ""
			}
		}
		if techMapNames[strings.ToLower(value)] {
			return ""
		}
		return "Malformed icon id: " + value
	}
	parts := strings.Split(value, ":")
	if len(parts) != 2 {
		return "Malformed icon id: " + value
	}
	if !validIconPrefixes[parts[0]] {
		return "Unknown icon prefix in id: " + value
	}
	if parts[1] == "" {
		return "Malformed icon id: " + value
	}
	return ""
}
