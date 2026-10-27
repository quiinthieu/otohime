import { projectStories } from "@/content/project-stories";
import { CardArt } from "./art";
/** Server component: the complete readable record survives without JS. */
export function ProjectStories() {
  return <div className="kamishibai-stories">
    {Object.values(projectStories).map(story => <section key={story.href} aria-labelledby={`story-${story.href.slice(1)}`}>
      <h3 id={`story-${story.href.slice(1)}`}><a href={story.href}>{story.title}</a></h3>
      <ol>{story.cards.map(card => <li key={card.id}>
        <CardArt card={card} /><h4>{card.title}</h4><p>{card.caption}</p>
      </li>)}</ol>
    </section>)}
  </div>;
}
