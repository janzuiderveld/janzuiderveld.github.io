import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/conversations/conversations_ascii.txt?raw';
import projectText from '../assets/conversations/conversations_text.txt?raw';
import projectPhoto from '../assets/conversations/pictures/conversations_placeholder.png';
import { CONVERSATIONS_ALIGN_DEFAULT } from '../assets/conversations/align';

function ConversationsBeyondTheOrdinaryPage() {
  return (
    <ProjectPage
      title='Conversations Beyond the Ordinary'
      text={projectText}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Conversations Beyond the Ordinary placeholder' }}
      align={CONVERSATIONS_ALIGN_DEFAULT}
    />
  );
}

export default ConversationsBeyondTheOrdinaryPage;
