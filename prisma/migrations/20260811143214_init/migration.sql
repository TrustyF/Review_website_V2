-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('TMDB', 'MANGADEX', 'IGDB', 'COMIC_VINE', 'GOOGLE_BOOKS');

-- CreateEnum
CREATE TYPE "ListSortMode" AS ENUM ('RANKED', 'RATED', 'UNSORTED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'SHORT', 'TVSHOW', 'MANGA', 'COMIC', 'GAME', 'BOOK');

-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('ANNOUNCED', 'UPCOMING', 'RELEASED', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RatingSource" AS ENUM ('IMDB', 'LETTERBOXD', 'ROTTEN_TOMATOES', 'METACRITIC');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "MediaChangeLog" (
    "id" SERIAL NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MediaChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode2" TEXT NOT NULL,
    "flag" TEXT,
    "region" TEXT,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" "Source" NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "type" TEXT NOT NULL,
    "logoPath" TEXT,
    "countryId" INTEGER,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "origin" "MediaType" NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" SERIAL NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "personId" INTEGER,
    "companyId" INTEGER,
    "order" INTEGER,
    "character" TEXT,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "origin" "MediaType" NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaGenre" (
    "mediaId" INTEGER NOT NULL,
    "genreId" INTEGER NOT NULL,

    CONSTRAINT "MediaGenre_pkey" PRIMARY KEY ("mediaId","genreId")
);

-- CreateTable
CREATE TABLE "List" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "sortMode" "ListSortMode" NOT NULL DEFAULT 'RANKED',
    "createDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListItem" (
    "listId" INTEGER NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("listId","mediaId")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "alternateTitle" TEXT,
    "type" "MediaType" NOT NULL,
    "overview" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'RELEASED',
    "publicRating" DOUBLE PRECISION,
    "posterPath" TEXT,
    "bannerPath" TEXT,
    "bannerFocusY" INTEGER NOT NULL DEFAULT 50,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "externalId" TEXT,
    "directLink" TEXT,
    "sourceUrl" TEXT,
    "countryId" INTEGER,
    "releaseDate" TIMESTAMP(3),
    "createDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updateDate" TIMESTAMP(3),
    "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING',
    "lastEnrichedAt" TIMESTAMP(3),

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movie" (
    "mediaID" INTEGER NOT NULL,
    "runtime" INTEGER,
    "budget" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION,
    "tagline" TEXT,
    "imdbID" TEXT,
    "originalLanguage" TEXT,

    CONSTRAINT "Movie_pkey" PRIMARY KEY ("mediaID")
);

-- CreateTable
CREATE TABLE "TvShow" (
    "mediaID" INTEGER NOT NULL,
    "episodeCount" INTEGER,
    "seasonCount" INTEGER,
    "network" TEXT,

    CONSTRAINT "TvShow_pkey" PRIMARY KEY ("mediaID")
);

-- CreateTable
CREATE TABLE "Manga" (
    "mediaID" INTEGER NOT NULL,
    "chapterCount" INTEGER,
    "volumeCount" INTEGER,

    CONSTRAINT "Manga_pkey" PRIMARY KEY ("mediaID")
);

-- CreateTable
CREATE TABLE "Comic" (
    "mediaID" INTEGER NOT NULL,
    "chapterCount" INTEGER,
    "volumeCount" INTEGER,

    CONSTRAINT "Comic_pkey" PRIMARY KEY ("mediaID")
);

-- CreateTable
CREATE TABLE "Game" (
    "mediaID" INTEGER NOT NULL,
    "platform" TEXT,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("mediaID")
);

-- CreateTable
CREATE TABLE "Book" (
    "mediaID" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "isbn" TEXT,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("mediaID")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "difficulty" INTEGER,
    "body" TEXT,
    "reviewDate" TIMESTAMP(3),
    "createDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateDate" TIMESTAMP(3),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("userId","mediaId")
);

-- CreateIndex
CREATE INDEX "MediaChangeLog_mediaId_idx" ON "MediaChangeLog"("mediaId");

-- CreateIndex
CREATE INDEX "MediaChangeLog_deletedAt_idx" ON "MediaChangeLog"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_countryCode2_key" ON "Country"("countryCode2");

-- CreateIndex
CREATE UNIQUE INDEX "Person_externalId_source_key" ON "Person"("externalId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Company_externalId_source_key" ON "Company"("externalId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_origin_key" ON "Role"("name", "origin");

-- CreateIndex
CREATE INDEX "Credit_mediaId_idx" ON "Credit"("mediaId");

-- CreateIndex
CREATE INDEX "Credit_personId_idx" ON "Credit"("personId");

-- CreateIndex
CREATE INDEX "Credit_companyId_idx" ON "Credit"("companyId");

-- CreateIndex
CREATE INDEX "Credit_roleId_idx" ON "Credit"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_origin_key" ON "Genre"("name", "origin");

-- CreateIndex
CREATE INDEX "ListItem_mediaId_idx" ON "ListItem"("mediaId");

-- CreateIndex
CREATE INDEX "ListItem_listId_rank_idx" ON "ListItem"("listId", "rank");

-- CreateIndex
CREATE INDEX "Media_type_enrichmentStatus_releaseDate_idx" ON "Media"("type", "enrichmentStatus", "releaseDate");

-- CreateIndex
CREATE INDEX "Media_enrichmentStatus_isDeleted_idx" ON "Media"("enrichmentStatus", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Media_externalId_type_key" ON "Media"("externalId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Review_mediaId_key" ON "Review"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "WatchlistItem_mediaId_idx" ON "WatchlistItem"("mediaId");

-- AddForeignKey
ALTER TABLE "MediaChangeLog" ADD CONSTRAINT "MediaChangeLog_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaGenre" ADD CONSTRAINT "MediaGenre_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaGenre" ADD CONSTRAINT "MediaGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_mediaID_fkey" FOREIGN KEY ("mediaID") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TvShow" ADD CONSTRAINT "TvShow_mediaID_fkey" FOREIGN KEY ("mediaID") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manga" ADD CONSTRAINT "Manga_mediaID_fkey" FOREIGN KEY ("mediaID") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comic" ADD CONSTRAINT "Comic_mediaID_fkey" FOREIGN KEY ("mediaID") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_mediaID_fkey" FOREIGN KEY ("mediaID") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_mediaID_fkey" FOREIGN KEY ("mediaID") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

