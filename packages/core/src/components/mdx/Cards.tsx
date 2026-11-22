import { SiteIcon } from "../SiteIcon.tsx";
import { Link } from "./Link.tsx";

/**
 * Cards — an author-written grid of cards: hand-picked links or
 * notes in the middle of a page. Unlike TopicList, which builds
 * its cards from the page tree, these cards are written out in
 * the MDX by hand. Each Card takes a title, an optional
 * description, an optional icon (an Iconify id), and an optional
 * href — with an href the whole card is a link, without one it
 * is a plain card. Children render below the description.
 */
export function Cards({ children }: { children?: React.ReactNode }) {
  return (
    <div className="porto-cards-wrapper not-content">
      <div className="porto-cards">{children}</div>
    </div>
  );
}

/**
 * Card — one card in a `Cards` grid: a title, an optional
 * description and icon, and an optional href that turns the
 * whole card into a link. Children render below the description.
 */
export function Card({
  title,
  description,
  href,
  icon,
  children,
}: {
  /** The card title. */
  title: string;
  /** A short line under the title. */
  description?: string;
  /** The link destination — with one the whole card is a link. */
  href?: string;
  /** An Iconify id for the icon beside the title, like `lu:rocket`. */
  icon?: string;
  children?: React.ReactNode;
}) {
  /* The title stays an `h2`, like TopicList's card titles: the
     URL snapshot only tracks h1/h2 headings. */
  const body = (
    <>
      <h2 className="porto-card__title">
        {icon ? (
          <span className="porto-card__icon">
            <SiteIcon icon={icon} slug={title} size="23px" />
          </span>
        ) : null}
        <span className="porto-card__title-text">{title}</span>
      </h2>
      {description ? (
        <p className="porto-card__description">{description}</p>
      ) : null}
      {children ? <div className="porto-card__body">{children}</div> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="porto-card">
        {body}
      </Link>
    );
  }
  return <div className="porto-card">{body}</div>;
}
