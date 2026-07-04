import { db } from '@/lib/db'

// export async function resolvePerson(name: string) {
//   if (!name) throw new Error('resolvePerson: missing name')
//
//   return db.person.upsert({
//     where: { name },
//     update: {},
//     create: { name },
//   })
// }
//
// export async function resolveCompany(name: string) {
//   if (!name) throw new Error('resolveCompany: missing name')
//
//   return db.company.upsert({
//     where: { name },
//     update: {},
//     create: { name, type },
//   })
// }

export async function resolveCountry(code2: string, name?: string) {
  if (!code2) throw new Error('resolveCountry: missing country code')

  const country_code = code2.toUpperCase()

  return db.country.upsert({
    where: { countryCode2: country_code },
    update: {},
    create: {
      countryCode2: country_code,
      name: name ?? country_code,
    },
  })
}
