import React from 'react';
import { Helmet } from 'react-helmet';

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
  twitterCard?: string;
}

export const MetaTags: React.FC<MetaTagsProps> = ({
  title = "Live LoL Esports - Real-time League of Legends Esports Viewer",
  description = "Follow League of Legends esports in real-time. View live match data, schedules, gold graphs, objective timelines, and post-game insights.",
  image = "https://live-lol-esports.goralabs.dev/social-share.png",
  url = "https://live-lol-esports.goralabs.dev/",
  type = "website",
  siteName = "Live LoL Esports",
  twitterCard = "summary_large_image"
}) => {
  return (
    <Helmet
      title={title}
      meta={[
        { name: 'title', content: title },
        { name: 'description', content: description },
        
        // Open Graph / Facebook
        { property: 'og:type', content: type },
        { property: 'og:url', content: url },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:image', content: image },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:site_name', content: siteName },
        
        // Twitter
        { property: 'twitter:card', content: twitterCard },
        { property: 'twitter:url', content: url },
        { property: 'twitter:title', content: title },
        { property: 'twitter:description', content: description },
        { property: 'twitter:image', content: image },
      ]}
    />
  );
};