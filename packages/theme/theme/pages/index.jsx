import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import UpdateTitle from "../utils/updateTitle.jsx";
import HeroSection from "../components/HeroSection/index.jsx";
import AboutSection from "../components/AboutSection/index.jsx";
import ProjectsSection from "../components/ProjectsSection/index.jsx";
import ContactSection from "../components/ContactSection/index.jsx";
import ExperienceSection from "../components/ExperienceSection/index.jsx";
import NavArrow from "../components/NavArrow/index.jsx";

export default function Home() {
  const { siteConfig } = useDocusaurusContext();

  const sectionTitles = {
    me: `Home | ${siteConfig.title}`,
    about: `About Me | ${siteConfig.title}`,
    projects: `Projects | ${siteConfig.title}`,
    experience: `Experience | ${siteConfig.title}`,
    contact: `Contact | ${siteConfig.title}`,
  };

  const customStyles = `
  /* For future */
  `;

  return (
    <Layout title="Me" description="My portfolio website">
      <style>{customStyles}</style>
      <UpdateTitle sections={sectionTitles} defaultTitle={siteConfig.title} />
      <main>
        <HeroSection id="me" />
        <AboutSection id="about" />
        <ProjectsSection id="projects" />
        <ExperienceSection id="experience" />
        <ContactSection id="contact" />
        <NavArrow />
      </main>
    </Layout>
  );
}
