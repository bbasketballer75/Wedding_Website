import React from 'react'
import { Helmet } from 'react-helmet-async'

const MetaTags = ({
  title = "Austin & Jordyn's Wedding | The Memories",
  description = "Relive the beautiful memories from Austin & Jordyn's wedding at The Lodge at Indian Lake. View our photos, family films, and guestbook.",
  image = '/images/engagement/PoradaProposal-29.webp',
  url = 'https://austinandjordyn.com',
  type = 'website',
  structuredData = null,
}) => {
  const fullTitle = title.includes('Austin & Jordyn')
    ? title
    : `${title} | Austin & Jordyn's Wedding`
  const fullUrl = url.startsWith('http') ? url : `https://austinandjordyn.com${url}`

  return (
    <Helmet>
      {/* Basic meta tags */}
      <title>{fullTitle}</title>
      <meta name='description' content={description} />

      {/* Open Graph / Facebook */}
      <meta property='og:type' content={type} />
      <meta property='og:url' content={fullUrl} />
      <meta property='og:title' content={fullTitle} />
      <meta property='og:description' content={description} />
      <meta
        property='og:image'
        content={image.startsWith('http') ? image : `https://austinandjordyn.com${image}`}
      />

      {/* Twitter */}
      <meta property='twitter:card' content='summary_large_image' />
      <meta property='twitter:url' content={fullUrl} />
      <meta property='twitter:title' content={fullTitle} />
      <meta property='twitter:description' content={description} />
      <meta
        property='twitter:image'
        content={image.startsWith('http') ? image : `https://austinandjordyn.com${image}`}
      />

      {/* Additional meta tags */}
      <meta name='theme-color' content='#ff6b35' />
      <meta name='apple-mobile-web-app-capable' content='yes' />
      <meta name='apple-mobile-web-app-status-bar-style' content='default' />
      <meta name='apple-mobile-web-app-title' content='A&J Wedding' />

      {/* Canonical URL */}
      <link rel='canonical' href={fullUrl} />

      {/* Structured Data */}
      {structuredData && (
        <script type='application/ld+json'>{JSON.stringify(structuredData)}</script>
      )}
    </Helmet>
  )
}

export default MetaTags
