export interface WeddingPartyPerson {
  id: string
  name: string
  fullName?: string
  role: string
  side: 'bride' | 'groom'
  image: string
  mirrorImage?: boolean
  description?: string
  funFact?: string
}

export const partyData: {
  couple: WeddingPartyPerson[]
  parents: WeddingPartyPerson[]
  groomsmen: WeddingPartyPerson[]
  bridesmaids: WeddingPartyPerson[]
} = {
  couple: [
    {
      id: 'groom',
      name: 'Austin',
      fullName: 'Austin Porada',
      role: 'The Groom',
      description: 'The luckiest man alive.',
      funFact: "Still can't believe she said yes.",
      side: 'groom',
      image: '/images/couple/austin.png',
      mirrorImage: true,
    },
    {
      id: 'bride',
      name: 'Jordyn',
      fullName: 'Jordyn Porada',
      role: 'The Bride',
      side: 'bride',
      image: '/images/couple/jordyn.png',
    },
  ],
  parents: [
    {
      id: 'groom-mom-2',
      name: 'Heather',
      fullName: 'Heather Shaffer',
      role: 'Mother of the Groom',
      side: 'groom',
      image: '/images/parents/heather.webp',
    },
    {
      id: 'groom-mom-1',
      name: 'Melony',
      fullName: 'Melony Porada',
      role: 'Mother of the Groom',
      description: 'My biggest supporter.',
      side: 'groom',
      image: '/images/parents/melony.webp',
      mirrorImage: true,
    },
    {
      id: 'bride-dad',
      name: 'Jerame',
      fullName: 'Jerame Pringle',
      role: 'Father of the Bride',
      side: 'bride',
      image: '/images/parents/jerame.webp',
    },
    {
      id: 'bride-mom',
      name: 'Christine',
      fullName: 'Christine Pringle',
      role: 'Mother of the Bride',
      side: 'bride',
      image: '/images/parents/christine.webp',
    },
  ],
  groomsmen: [
    {
      id: 'bm',
      name: 'Tyler',
      fullName: 'Tyler Sharpe',
      role: 'Best Man',
      description: 'Brother from another mother.',
      side: 'groom',
      image: '/images/wedding-party/groomsmen/tyler-sharpe.webp',
    },
    {
      id: 'gm1',
      name: 'Alex',
      fullName: 'Alex Molnar',
      role: 'Groomsman',
      side: 'groom',
      image: '/images/wedding-party/groomsmen/alex-molnar.webp',
    },
    {
      id: 'gm2',
      name: 'Brosnan',
      fullName: 'Brosnan McCray',
      role: 'Groomsman',
      side: 'groom',
      image: '/images/wedding-party/groomsmen/brosonan-mccray.webp',
    },
    {
      id: 'gm3',
      name: 'Ean',
      fullName: 'Ean Pringle',
      role: 'Groomsman',
      side: 'groom',
      image: '/images/wedding-party/groomsmen/ean-pringle.webp',
    },
    {
      id: 'gm4',
      name: 'Eddie',
      fullName: 'Eddie Migut',
      role: 'Groomsman',
      side: 'groom',
      image: '/images/wedding-party/groomsmen/eddie-migut.webp',
    },
    {
      id: 'gm5',
      name: 'Ian',
      fullName: 'Ian Porada',
      role: 'Groomsman',
      side: 'groom',
      image: '/images/wedding-party/groomsmen/ian-porada.webp',
    },
    {
      id: 'gm6',
      name: 'Nate',
      fullName: 'Nate Berkebile',
      role: 'Groomsman',
      side: 'groom',
      image: '/images/wedding-party/groomsmen/nate-berkebile.webp',
    },
  ],
  bridesmaids: [
    {
      id: 'bm3',
      name: 'Maria',
      fullName: 'Maria McCray',
      role: 'Officiant & Bridesmaid',
      description: 'She stood with the bridal party and also officiated the ceremony.',
      side: 'bride',
      image: '/images/wedding-party/bridesmaids/maria-mccray.webp',
    },
    {
      id: 'moh',
      name: 'Lexi',
      fullName: 'Lexi Berkebile',
      role: 'Matron of Honor',
      description: "Jordyn's ride or die.",
      side: 'bride',
      image: '/images/wedding-party/bridesmaids/lexi-berkebile.webp',
    },
    {
      id: 'bm1',
      name: 'Emily',
      fullName: 'Emily Aurandt',
      role: 'Bridesmaid',
      side: 'bride',
      image: '/images/wedding-party/bridesmaids/emily-aurandt.webp',
      mirrorImage: true,
    },
    {
      id: 'bm2',
      name: 'Hannah',
      fullName: 'Hannah Porada',
      role: 'Bridesmaid',
      side: 'bride',
      image: '/images/wedding-party/bridesmaids/hannah-porada.webp',
    },
    {
      id: 'bm4',
      name: 'Micaela',
      fullName: 'Micaela Helsel',
      role: 'Bridesmaid',
      side: 'bride',
      image: '/images/wedding-party/bridesmaids/micaela-helsel.webp',
    },
    {
      id: 'bm5',
      name: 'Brinnah',
      fullName: 'Brinnah Helsel',
      role: 'Bridesmaid',
      side: 'bride',
      image: '/images/wedding-party/bridesmaids/brinnah-helsel.webp',
    },
    {
      id: 'bm6',
      name: 'Caitie',
      fullName: 'Caitie Helsel',
      role: 'Bridesmaid',
      side: 'bride',
      image: '/images/wedding-party/bridesmaids/caitie-helsel.webp',
    },
  ],
}
