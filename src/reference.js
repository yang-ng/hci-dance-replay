const base = import.meta.env.BASE_URL

export const referenceClips = [
  {
    id: 'freestyle',
    name: 'Purple light freestyle',
    style: 'Freestyle · Solo',
    duration: 6,
    credit: 'SHVETS production',
    source: 'https://www.pexels.com/video/a-person-dancing-happily-7198400/',
  },
  {
    id: 'breaking',
    name: 'Breaking in the studio',
    style: 'Breaking · Solo',
    duration: 5,
    credit: 'cami',
    source: 'https://www.pexels.com/video/dynamic-breakdancing-performance-in-studio-35449636/',
  },
  {
    id: 'contemporary',
    name: 'Contemporary studio duet',
    style: 'Contemporary · Partner',
    duration: 12,
    credit: 'Michael',
    source: 'https://www.pexels.com/video/contemporary-dance-duo-in-minimalist-studio-34780658/',
  },
].map(clip => ({
  ...clip,
  src: `${base}reference/${clip.id}.mp4`,
  poster: `${base}reference/${clip.id}.jpg`,
}))

export const referenceById = id => referenceClips.find(clip => clip.id === id)
