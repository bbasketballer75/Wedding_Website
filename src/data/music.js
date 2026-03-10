import { getMediaPath } from '@/utils/media'

export const mainPlaylist = [
  {
    title: 'First Time (Acoustic)',
    artist: 'Seven Lions, Slander, Dabin (feat. Dylan Matthew)',
    src: getMediaPath('/background_audio/01 - Seven Lions - First Time (feat. Dylan Matthew) (Acoustic).mp3'),
  },
  {
    title: 'The Kind of Love We Make',
    artist: 'Luke Combs',
    src: getMediaPath('/background_audio/03 - Luke Combs - The Kind of Love We Make.mp3'),
  },
  {
    title: 'Forever After All',
    artist: 'Luke Combs',
    src: getMediaPath('/background_audio/23 - Luke Combs - Forever After All.mp3'),
  },
  {
    title: 'Paradise',
    artist: 'Bazzi',
    src: getMediaPath('/background_audio/Bazzi - Paradise.mp3'),
  },
  {
    title: 'Glad You Exist',
    artist: 'Dan + Shay',
    src: getMediaPath('/background_audio/Dan + Shay - Glad You Exist.mp3'),
  },
  {
    title: 'Speechless (Acoustic)',
    artist: 'Dan + Shay',
    src: getMediaPath('/background_audio/Dan + Shay - Speechless  (Acoustic).mp3'),
  },
  {
    title: 'You',
    artist: 'Dan + Shay',
    src: getMediaPath('/background_audio/Dan + Shay - You.mp3'),
  },
  {
    title: 'BUTTERFLIES',
    artist: 'Max',
    src: getMediaPath('/background_audio/Max - BUTTERFLIES.mp3'),
  },
  {
    title: 'Man I Need',
    artist: 'Olivia Dean',
    src: getMediaPath('/background_audio/Olivia Dean - Man I Need.mp3'),
  },
  {
    title: "You're Still The One",
    artist: 'Shania Twain',
    src: getMediaPath("/background_audio/Shania Twain - You're Still The One (Remixed_Remastered 2004).mp3"),
  },
]

export const halloweenTrack = {
  title: 'Toccata and Fugue in D minor',
  artist: 'Johann Sebastian Bach',
  src: getMediaPath('/background_audio/SPOOKY ENGAGEMENT SECTION/03 - Johann Sebastian Bach - Toccata and Fugue in D minor.mp3'),
}

export const sfx = {
  rewind: null, // '/music/rewind-sfx.mp3' - Missing file
  vinylStart: null, // '/music/vinyl-start.mp3' - Missing file
}
