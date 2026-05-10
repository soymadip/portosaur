import { TbBrandCSharp, TbBrandVscode, TbBrandOnedrive, TbBrandAzure, TbBrandBing, TbBrandGithubCopilot } from "react-icons/tb";
import { GrVirtualMachine } from "react-icons/gr";
import { DiRasberryPi } from "react-icons/di";
import { PiGithubLogoFill, PiMicrosoftExcelLogoDuotone, PiMicrosoftOutlookLogo, PiMicrosoftPowerpointLogo, PiMicrosoftWordLogo } from "react-icons/pi";
import { BiLogoPostgresql, BiLogoWindows } from "react-icons/bi";
import { BsFiletypeXlsx, BsFiletypeDocx, BsFiletypePpt, BsMicrosoftTeams } from "react-icons/bs";
import { TiVendorMicrosoft } from "react-icons/ti";

import { 
  SiPython, SiJavascript, SiCplusplus, SiRust, SiGo, SiTypescript, SiReact, SiMysql, SiGnubash, 
  SiLinux, SiLinuxfoundation, SiArchlinux, SiAlmalinux, SiAlpinelinux, SiKalilinux, SiLinuxmint, 
  SiRockylinux, SiVoidlinux, SiUbuntu, SiKubuntu, SiUbuntumate, SiDebian, SiRedhat, SiGithub, 
  SiMastodon, SiInstagram, SiFacebook, SiYoutube, SiTwitch, SiDiscord, SiReddit, 
  SiStackoverflow, SiLeetcode, SiHackerrank, SiCodeforces, SiMatrix, SiGmail, SiProtonmail, SiSignal, SiReplit,
  SiZoom, SiNotion, SiObsidian, SiMarkdown, SiSubstack, SiThreads, SiOpenai, SiDocker, SiPodman, 
  SiLinuxcontainers, SiVmware, SiXing, SiKaggle, SiCodesandbox,
  SiGooglechrome, SiFirefox, SiSafari, SiBrave, SiOpera, SiTorbrowser, SiVivaldi, SiZendesk,
  SiImdb, SiMyanimelist, SiAnilist, SiLetterboxd, SiCrunchyroll, SiKitsu, SiSimkl,
  SiMongodb, SiSqlite, SiMariadb, SiInfluxdb, SiRedis, SiCouchbase, SiApachecassandra,
  SiFirebase, SiNeo4J, SiElasticsearch, SiGraphql, SiGoogledrive
} from 'react-icons/si';

import { 
  FaJava, FaEnvelope, FaRss, FaGitAlt, FaTwitter, FaTelegramPlane, FaMedium, FaPhp, 
  FaGlobe, FaDev, FaPinterest, FaWhatsapp, FaSlack, FaSkype, FaSnapchatGhost, FaTiktok, FaSteam, 
  FaGitlab, FaBitbucket, FaKeybase, FaCodepen, FaJsSquare, FaHackerNews, FaVimeoV, FaFlickr, 
  FaDribbble, FaBehance, FaPatreon, FaPaypal, FaEthereum, FaBitcoin, FaLaptopCode, FaCode, 
  FaBlogger, FaWordpress, FaHashtag, FaUserCircle, FaUserSecret, FaBug, FaRobot, FaHtml5, FaCss3Alt, 
  FaFedora, FaInternetExplorer, FaEdge, FaTv, FaFilm, FaVideo, FaPodcast,
  FaSearch, FaCog, FaEdit, FaHome, FaInfoCircle, FaLink, FaDownload, 
  FaUpload, FaSave, FaTrash, FaExclamationTriangle, FaExclamationCircle, FaCheckCircle, 
  FaQuestionCircle, FaClock, FaComments, FaBell, FaDatabase,
  FaCalendar, FaCheckSquare, FaBookmark, FaStar, FaHeart, FaClipboard, FaEnvelopeOpen,
  FaMicrosoft, FaGoogleDrive, FaLinkedin
} from "react-icons/fa";



//--------- Icon mappings ---------

export const iconMap = {

  // Programming languages
  python: { icon: SiPython, color: '#3776AB' },
  javascript: { icon: SiJavascript, color: '#F7DF1E' },
  jssquare: { icon: FaJsSquare, color: '#F7DF1E' },
  typescript: { icon: SiTypescript, color: '#3178C6' },
  cpp: { icon: SiCplusplus, color: '#00599C' },
  csharp: { icon: TbBrandCSharp, color: '#239120' },
  rust: { icon: SiRust, color: '#ffffff' },
  go: { icon: SiGo, color: '#00ADD8' },
  java: { icon: FaJava, color: '#007396' },
  php: { icon: FaPhp, color: '#777BB4' },
  html: { icon: FaHtml5, color: '#E34F26' },
  css: { icon: FaCss3Alt, color: '#1572B6' },
  sql: { icon: SiMysql, color: '#4479A1' },
  postgresql: { icon: BiLogoPostgresql, color: '#336791' },
  postgres: { icon: BiLogoPostgresql, color: '#336791' },
  oraclesql: { icon: FaDatabase, color: '#F80000' },
  oracle: { icon: FaDatabase, color: '#F80000' },
  database: { icon: FaDatabase, color: '#47A248' },
  db: { icon: FaDatabase, color: '#47A248' },
  dbms: { icon: FaDatabase, color: '#47A248' },
  mysql: { icon: SiMysql, color: '#4479A1' },
  mariadb: { icon: SiMariadb, color: '#003545' },
  sqlite: { icon: SiSqlite, color: '#003B57' },
  mongodb: { icon: SiMongodb, color: '#47A248' },
  mongo: { icon: SiMongodb, color: '#47A248' },
  nosql: { icon: SiMongodb, color: '#47A248' },
  redis: { icon: SiRedis, color: '#DC382D' },
  couchbase: { icon: SiCouchbase, color: '#EA2328' },
  cassandra: { icon: SiApachecassandra, color: '#1287B1' },
  dynamodb: { icon: FaDatabase, color: '#4053D6' },
  firebase: { icon: SiFirebase, color: '#FFCA28' },
  firestore: { icon: SiFirebase, color: '#FFCA28' },
  mssql: { icon: FaDatabase, color: '#CC2927' },
  sqlserver: { icon: FaDatabase, color: '#CC2927' },
  microsoftsqlserver: { icon: FaDatabase, color: '#CC2927' },
  neo4j: { icon: SiNeo4J, color: '#008CC1' },
  graphdb: { icon: SiNeo4J, color: '#008CC1' },
  elasticsearch: { icon: SiElasticsearch, color: '#005571' },
  graphql: { icon: SiGraphql, color: '#E10098' },
  influxdb: { icon: SiInfluxdb, color: '#22ADF6' },
  timeseries: { icon: SiInfluxdb, color: '#22ADF6' },

  // Competitive programming platforms
  leetcode: { icon: SiLeetcode, color: '#FFA116' },
  hackerrank: { icon: SiHackerrank, color: '#2EC866' },
  codeforces: { icon: SiCodeforces, color: '#1F8ACB' },
  replit: { icon: SiReplit, color: '#FA5302' },

  


  
  // Operating systems and containers
  linux: { icon: SiLinux, color: '#FCC624' },
  linuxfoundation: { icon: SiLinuxfoundation, color: '#000000' },
  arch: { icon: SiArchlinux, color: '#1793D1' },
  archlinux: { icon: SiArchlinux, color: '#1793D1' },
  ubuntu: { icon: SiUbuntu, color: '#E95420' },
  kubuntu: { icon: SiKubuntu, color: '#0078D6' },
  ubuntumate: { icon: SiUbuntumate, color: '#2C001E' },
  debian: { icon: SiDebian, color: '#A80030' },
  redhat: { icon: SiRedhat, color: '#EE0000' },
  fedora: { icon: FaFedora, color: '#294172' },
  kalilinux: { icon: SiKalilinux, color: '#557C94' },
  linuxmint: { icon: SiLinuxmint, color: '#87CF3E' },
  voidlinux: { icon: SiVoidlinux, color: '#8BC1A2' },
  alpinelinux: { icon: SiAlpinelinux, color: '#0D597F' },
  alpine: { icon: SiAlpinelinux, color: '#0D597F' },
  almalinux: { icon: SiAlmalinux, color: '#1793D1' },
  rockylinux: { icon: SiRockylinux, color: '#000000' },
  raspberry: { icon: DiRasberryPi, color: '#C51A4A' },
  raspberryPi: { icon: DiRasberryPi, color: '#C51A4A' },
  raspberrypi: { icon: DiRasberryPi, color: '#C51A4A' },
  raspberryPiZero: { icon: DiRasberryPi, color: '#C51A4A' },
  raspian: { icon: DiRasberryPi, color: '#C51A4A' },
  docker: { icon: SiDocker, color: '#2496ED' },
  podman: { icon: SiPodman, color: '#2496ED' },
  container: { icon: SiLinuxcontainers, color: '#2496ED' },
  containers: { icon: SiLinuxcontainers, color: '#2496ED' },
  linuxcontainers: { icon: SiLinuxcontainers, color: '#2496ED' },
  vm: { icon: GrVirtualMachine, color: '#000000' },
  vmware: { icon: SiVmware, color: '#F3801D' },


  // Shells and tools
  shell: { icon: SiGnubash, color: '#4EAA25' },
  bash: { icon: SiGnubash, color: '#4EAA25' },
  react: { icon: SiReact, color: '#61DAFB' },


  // Social platforms
  github: { icon: SiGithub, color: '#585b70' },
  githubalt: { icon: PiGithubLogoFill, color: '#585b70' },
  git: { icon: FaGitAlt, color: '#F05032' },
  gitlab: { icon: FaGitlab, color: '#FC6D26' },
  bitbucket: { icon: FaBitbucket, color: '#0052CC' },
  linkedin: { icon: FaLinkedin, color: '#0A66C2' },
  twitter: { icon: FaTwitter, color: '#1DA1F2' },
  x: { icon: FaTwitter, color: '#1DA1F2' },
  mastodon: { icon: SiMastodon, color: '#6364FF' },
  instagram: { icon: SiInstagram, color: '#E4405F' },
  insta: { icon: SiInstagram, color: '#E4405F' },
  facebook: { icon: SiFacebook, color: '#1877F2' },
  fb: { icon: SiFacebook, color: '#1877F2' },
  youtube: { icon: SiYoutube, color: '#FF0000' },
  yt: { icon: SiYoutube, color: '#FF0000' },
  twitch: { icon: SiTwitch, color: '#9146FF' },
  discord: { icon: SiDiscord, color: '#5865F2' },
  discordapp: { icon: SiDiscord, color: '#5865F2' },
  reddit: { icon: SiReddit, color: '#FF4500' },
  stackoverflow: { icon: SiStackoverflow, color: '#F58025' },
  pinterest: { icon: FaPinterest, color: '#E60023' },
  snapchat: { icon: FaSnapchatGhost, color: '#FFFC00' },
  tiktok: { icon: FaTiktok, color: '#000000' },
  threads: { icon: SiThreads, color: '#000000' },
  

  // Utility icons
  note: { icon: SiObsidian, color: '#7C3AED' },
  notes: { icon: SiObsidian, color: '#7C3AED' },
  document: { icon: SiNotion, color: '#000000' },
  docs: { icon: SiNotion, color: '#000000' },
  calendar: { icon: FaCalendar, color: '#4285F4' },
  task: { icon: FaCheckSquare, color: '#00BCD4' },
  todo: { icon: FaCheckSquare, color: '#00BCD4' },
  bookmark: { icon: FaBookmark, color: '#FFC107' },
  star: { icon: FaStar, color: '#FFC107' },
  favorite: { icon: FaHeart, color: '#E91E63' },
  clipboard: { icon: FaClipboard, color: '#795548' },
  search: { icon: FaSearch, color: '#607D8B' },
  settings: { icon: FaCog, color: '#546E7A' },
  config: { icon: FaCog, color: '#546E7A' },
  edit: { icon: FaEdit, color: '#2196F3' },
  home: { icon: FaHome, color: '#8BC34A' },
  info: { icon: FaInfoCircle, color: '#2196F3' },
  link: { icon: FaLink, color: '#9C27B0' },
  url: { icon: FaLink, color: '#9C27B0' },
  download: { icon: FaDownload, color: '#00BCD4' },
  upload: { icon: FaUpload, color: '#FF9800' },
  save: { icon: FaSave, color: '#4CAF50' },
  delete: { icon: FaTrash, color: '#F44336' },
  remove: { icon: FaTrash, color: '#F44336' },
  warning: { icon: FaExclamationTriangle, color: '#FF9800' },
  error: { icon: FaExclamationCircle, color: '#F44336' },
  success: { icon: FaCheckCircle, color: '#4CAF50' },
  help: { icon: FaQuestionCircle, color: '#2196F3' },
  time: { icon: FaClock, color: '#607D8B' },
  clock: { icon: FaClock, color: '#607D8B' },
  chat: { icon: FaComments, color: '#03A9F4' },
  message: { icon: FaEnvelopeOpen, color: '#03A9F4' },
  notification: { icon: FaBell, color: '#FF9800' },
  alert: { icon: FaBell, color: '#FF9800' },

  // Messaging platforms
  telegram: { icon: FaTelegramPlane, color: '#26A5E4' },
  tg: { icon: FaTelegramPlane, color: '#26A5E4' },
  whatsapp: { icon: FaWhatsapp, color: '#25D366' },
  wp: { icon: FaWhatsapp, color: '#25D366' },
  slack: { icon: FaSlack, color: '#4A154B' },
  skype: { icon: FaSkype, color: '#00AFF0' },
  matrix: { icon: SiMatrix, color: '#000000' },
  signal: { icon: SiSignal, color: '#3A76F0' },
  zoom: { icon: SiZoom, color: '#2D8CFF' },


  // Email platforms
  email: { icon: FaEnvelope, color: '#EA4335' },
  mail: { icon: FaEnvelope, color: '#EA4335' },
  contact: { icon: FaEnvelope, color: '#EA4335' },
  gmail: { icon: SiGmail, color: '#EA4335' },
  protonmail: { icon: SiProtonmail, color: '#8B89CC' },


  // Blog/writing platforms
  medium: { icon: FaMedium, color: '#000000' },
  blog: { icon: FaBlogger, color: '#FF5722' },
  wordpress: { icon: FaWordpress, color: '#21759B' },
  substack: { icon: SiSubstack, color: '#FF6719' },
  dev: { icon: FaDev, color: '#0A0A0A' },
  rss: { icon: FaRss, color: '#FFA500' },


  // Creative platforms
  dribbble: { icon: FaDribbble, color: '#EA4C89' },
  behance: { icon: FaBehance, color: '#1769FF' },
  flickr: { icon: FaFlickr, color: '#0063DC' },
  vimeo: { icon: FaVimeoV, color: '#1AB7EA' },


  // Payment/donation
  patreon: { icon: FaPatreon, color: '#F96854' },
  paypal: { icon: FaPaypal, color: '#00457C' },
  ethereum: { icon: FaEthereum, color: '#3C3C3D' },
  bitcoin: { icon: FaBitcoin, color: '#F7931A' },


  // Professional
  xing: { icon: SiXing, color: '#006567' },
  kaggle: { icon: SiKaggle, color: '#20BEFF' },


  // Knowledge/note-taking
  notion: { icon: SiNotion, color: '#000000' },
  obsidian: { icon: SiObsidian, color: '#7C3AED' },
  markdown: { icon: SiMarkdown, color: '#000000' },


  // Misc
  hackernews: { icon: FaHackerNews, color: '#FF6600' },
  hn: { icon: FaHackerNews, color: '#FF6600' },
  keybase: { icon: FaKeybase, color: '#33A0FF' },
  openai: { icon: SiOpenai, color: '#412991' },
  code: { icon: FaCode, color: '#007ACC' },
  programming: { icon: FaLaptopCode, color: '#333333' },
  user: { icon: FaUserCircle, color: '#4285F4' },
  anonymous: { icon: FaUserSecret, color: '#666666' },
  debug: { icon: FaBug, color: '#E91E63' },
  bot: { icon: FaRobot, color: '#00BCD4' },
  steam: { icon: FaSteam, color: '#000000' },
  hashtag: { icon: FaHashtag, color: '#ffffff' },
  codesandbox: { icon: SiCodesandbox, color: '#151515' },
  codepen: { icon: FaCodepen, color: '#000000' },
  website: { icon: FaGlobe, color: '#4285F4' },
  web: { icon: FaGlobe, color: '#4285F4' },
  
  // Content and anime tracking
  imdb: { icon: SiImdb, color: '#F5C518' },
  tvdb: { icon: FaTv, color: '#4BB7AA' },
  themoviedb: { icon: FaFilm, color: '#01B4E4' },
  tmdb: { icon: FaFilm, color: '#01B4E4' },
  myanimelist: { icon: SiMyanimelist, color: '#2E51A2' },
  mal: { icon: SiMyanimelist, color: '#2E51A2' },
  anilist: { icon: SiAnilist, color: '#02A9FF' },
  simkl: { icon: SiSimkl, color: '#ffffff' },
  letterboxd: { icon: SiLetterboxd, color: '#00A13D' },
  trakt: { icon: FaVideo, color: '#ED1C24' },
  crunchyroll: { icon: SiCrunchyroll, color: '#F78B24' },
  kitsu: { icon: SiKitsu, color: '#F75239' },
  animenewsnetwork: { icon: FaPodcast, color: '#AA0000' },
  ann: { icon: FaPodcast, color: '#AA0000' },

  // Browsers
  chrome: { icon: SiGooglechrome, color: '#4285F4' },
  googlechrome: { icon: SiGooglechrome, color: '#4285F4' },
  firefox: { icon: SiFirefox, color: '#FF7139' },
  safari: { icon: SiSafari, color: '#000000' },
  edge: { icon: FaEdge, color: '#0078D7' },
  microsoftedge: { icon: FaEdge, color: '#0078D7' },
  brave: { icon: SiBrave, color: '#FB542B' },
  opera: { icon: SiOpera, color: '#FF1B2D' },
  tor: { icon: SiTorbrowser, color: '#7D4698' },
  torbrowser: { icon: SiTorbrowser, color: '#7D4698' },
  vivaldi: { icon: SiVivaldi, color: '#EF3939' },
  ie: { icon: FaInternetExplorer, color: '#0076D6' },
  internetexplorer: { icon: FaInternetExplorer, color: '#0076D6' },
  "zen-browser": { icon: SiZendesk, color: '#00363D' },
  zenbrowser: { icon: SiZendesk, color: '#00363D' },
  zen: { icon: SiZendesk, color: '#00363D' },
  
  // Microsoft
  windows: { icon: BiLogoWindows, color: '#0078D6' },
  windows10: { icon: TiVendorMicrosoft, color: '#F25022' },
  microsoft: { icon: FaMicrosoft, color: '#F25022' },
  office: { icon: TiVendorMicrosoft, color: '#D83B01' },
  excel: { icon: PiMicrosoftExcelLogoDuotone, color: '#217346' },
  excelduotone: { icon: PiMicrosoftExcelLogoDuotone, color: '#217346' },
  word: { icon: PiMicrosoftWordLogo, color: '#2B579A' },
  powerpoint: { icon: PiMicrosoftPowerpointLogo, color: '#D83B01' },
  powerpointlogo: { icon: PiMicrosoftPowerpointLogo, color: '#D83B01' },
  teams: { icon: BsMicrosoftTeams, color: '#6264A7' },
  teamsalt: { icon: BsMicrosoftTeams, color: '#6264A7' },
  onedrive: { icon: TbBrandOnedrive, color: '#0078D4' },
  azure: { icon: TbBrandAzure, color: '#0089D6' },
  bing: { icon: TbBrandBing, color: '#008373' },
  vscode: { icon: TbBrandVscode, color: '#007ACC' },
  outlook: { icon: PiMicrosoftOutlookLogo, color: '#0078D4' },
  fileword: { icon: BsFiletypeDocx, color: '#2B579A' },
  fileexcel: { icon: BsFiletypeXlsx, color: '#217346' },
  filepowerpoint: { icon: BsFiletypePpt, color: '#D83B01' },
  githubcopilot: { icon: TbBrandGithubCopilot, color: '#000000' },
  
  // Google products
  googledrive: { icon: FaGoogleDrive, color: '#0F9D58' },
  gdrive: { icon: SiGoogledrive, color: '#0F9D58' }

};
