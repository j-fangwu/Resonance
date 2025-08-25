const weaviate = require('weaviate-ts-client').default
require('dotenv').config();

class WeaviateClient {
    constructor() {
        this.client = this.createClient();
        this.isInitialized = false;
    }

    createClient() {
    const clientConfig = {
        scheme: 'http',
        host: process.env.WEAVIATE_URL?.replace('http://', '') || '127.0.0.1:8080', 
    };

    if (process.env.HUGGINGFACE_API_TOKEN) {
        clientConfig.headers = {
            'X-HuggingFace-API-Key': process.env.HUGGINGFACE_API_TOKEN
        };
    }

    return weaviate.client(clientConfig);
}

    async initialize() {
        if (this.isInitialized) return;

        try {
            await this.setupSchema();
            this.isInitialized = true;
            console.log('Weaviate client initialized successfully.');
        } catch (error) {
            console.error('Error initializing Weaviate client:', error);
            throw error;
        }
    }

    async setupSchema() {
        try {
            await this.client.schema.classDeleter().withClassName('Song').do().catch(() => {});
            await this.client.schema.classDeleter().withClassName('Playlist').do().catch(() => {});
        } catch (error) {
            console.error('Error setting up Weaviate schema:', error);
        }

        const songSchema = {
            class: 'Song',
            description: 'A song from Spotify with metadata and features',
            vectorizer: 'text2vec-huggingface',
            moduleConfig: {
                'text2vec-huggingface': {
                    model: process.env.HUGGINGFACE_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
                    options: {
                        waitForModel: true
                    }
                },
                'generative-huggingface': {
                    model: process.env.HUGGINGFACE_GENERATIVE_MODEL || 'microsoft/DialoGPT-medium',
                }
            },
            properties: [
                {
                    name: 'spotifyId',
                    dataType: ['string'],
                    description: 'Spotify track ID'
                },
                {
                    name: 'title',
                    dataType: ['string'],
                    description: 'Song title'
                },
                {
                    name: 'artist',
                    dataType: ['string'],
                    description: 'Song artist'
                },
                {
                    name: 'album',
                    dataType: ['string'],
                    description: 'Album name'
                },
                {
                    name: 'genre',
                    dataType: ['string[]'],
                    description: 'Song genre'
                },
                {
                    name: 'lyrics',
                    dataType: ['text'],
                    description: 'Song lyrics'  
                },
                {
                    name: 'audioFeatures',
                    dataType: ['object'],
                    description: 'Audio features of the song',
                    
                    nestedProperties: [
                        { name: 'acousticness', dataType: ['number'] },
                        { name: 'danceability', dataType: ['number'] },
                        { name: 'duration_ms', dataType: ['int'] },
                        { name: 'energy', dataType: ['number'] },
                        { name: 'instrumentalness', dataType: ['number'] },
                        { name: 'key', dataType: ['int'] },
                        { name: 'liveness', dataType: ['number'] },
                        { name: 'loudness', dataType: ['number'] },
                        { name: 'mode', dataType: ['int'] },
                        { name: 'speechiness', dataType: ['number'] },
                        { name: 'tempo', dataType: ['number'] },
                        { name: 'time_signature', dataType: ['int'] },
                        { name: 'valence', dataType: ['number'] }
                    ]
                },
                {
                    name: 'releaseDate',
                    dataType: ['date'],
                    description: 'Release date of the song'
                }, 
                {
                    name: 'popularity',
                    dataType: ['int'],
                    description: 'Popularity score of the song' 
                },
                {
                    name: 'description',
                    dataType: ['text'],
                    description: 'Description of the song'
                }
            ]
        };

        const playlistSchema = {
            class: 'Playlist',
            description: 'A playlist from Spotify with metadata',
            vectorizer: 'text2vec-huggingface',
            moduleConfig: {
                'text2vec-huggingface': {
                    model: process.env.HUGGINGFACE_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
                    options: {
                        waitForModel: true
                    }
                }
            },
            properties: [
                {
                    name: 'spotifyId',
                    dataType: ['string'],
                    description: 'Spotify playlist ID'
                },
                {
                    name: 'name',
                    dataType: ['string'],
                    description: 'Name of the playlist'
                },
                {
                    name: 'description',
                    dataType: ['text'],
                    description: 'Description of the playlist'
                },
                {
                    name: 'owner',
                    dataType: ['string'],
                    description: 'Owner of the playlist'
                },
                {
                    name: 'tags',
                    dataType: ['string[]'],
                    description: 'Tags associated with the playlist'
                },
                {
                    name: 'mood',
                    dataType: ['string'],
                    description: 'Mood of the playlist'
                },
                {
                    name: 'songCount',
                    dataType: ['int'],
                    description: 'Number of songs in the playlist'
                }
            ]
        };

        await this.client.schema.classCreator().withClass(songSchema).do();
        await this.client.schema.classCreator().withClass(playlistSchema).do();

        console.log('Weaviate schema setup completed.');
    }

    async addSong(songData) {
        await this.initialize();

        const descriptionParts = [
            songData.title || '',
            songData.artist || '',
            songData.album || '',
            Array.isArray(songData.genre) ? songData.genre.join(' ') : songData.genre || '',
            songData.lyrics ? songData.lyrics.substring(0, 500) : ''
        ];

        const description = descriptionParts.join(' ').trim();

        const processedData = {
            ...songData,
            description: descriptionParts.filter(Boolean).join(' ')
        };

        const result = await this.client.data
            .creator()
            .withClassName('Song')
            .withProperties(processedData)
            .do();

        return result.id;
    }

    async addPlaylist(playlistData) {
        await this.initialize();

        const result = await this.client.data
            .creator()
            .withClassName('Playlist')
            .withProperties(playlistData)
            .do();

        return result.id;
    }

    async semanticSearchSongs(query, limit = 10) {
        await this.initialize();

        const result = await this.client.graphql
            .get()
            .withClassName('Song')
            .withFields(`spotifyId title artist album genre popularity audioFeatures { acousticness danceability energy instrumentalness liveness loudness speechiness tempo valence }`)
            .withNearText({ concepts: [query] })
            .withLimit(limit)
            .withAdditional(['certainty'])
            .do();

        return result.data?.Get?.Song || [];
    }

    async generatePlaylistDescription(songs) {
        await this.initialize();

        const songDescriptions = songs.slice(0, 5).join(', ');
        
        const result = await this.client.graphql
            .get()
            .withClassName('Song')
            .withFields('title artist')
            .withGenerate({
                singlePrompt: `Based on the following songs: ${songDescriptions}, write a short, one-sentence, engaging description for this playlist that captures its mood and style:`
            })
            .withLimit(1)
            .do();

        const generated = result.data?.Get?.Song?.[0];
        if (generated?._additional?.generate?.singleResult) {
            return generated._additional.generate.singleResult;
        }

        return 'A curated collection of great music.';
    }

    async getSimilarSongs(songId, limit = 5) {
        await this.initialize();

        // Get the current song's details
        const currentSong = await this.client.data
            .getterById()
            .withId(songId)
            .do();

        const result = await this.client.graphql
            .get()
            .withClassName('Song')
            .withFields('spotifyId title artist album')
            .withNearObject({ id: songId })
            .withLimit(limit + 1)
            .withAdditional(['certainty'])
            .do();

        const songs = result.data?.Get?.Song || [];

        // Add null checking for currentSong
        const currentSpotifyId = currentSong?.properties?.spotifyId;
        if (!currentSpotifyId) {
            return songs.slice(0, limit);
        }

        return songs.filter(s => s.spotifyId !== currentSpotifyId).slice(0, limit);
    }

    async searchPlaylists(query, limit = 10) {
        await this.initialize();

        const result = await this.client.graphql
            .get()
            .withClassName('Playlist')
            .withFields('spotifyId name description owner mood songCount')
            .withNearText({ concepts: [query] })
            .withLimit(limit)
            .withAdditional(['certainty'])
            .do();

        return result.data?.Get?.Playlist || [];
    }

    async getPlaylistsByMood(mood, limit = 10) {
        await this.initialize();

        const result = await this.client.graphql
            .get()
            .withClassName('Playlist')
            .withFields('spotifyId name description owner mood songCount')
            .withWhere({
                path: ['mood'],
                operator: 'Equal',
                valueString: mood
            })
            .withLimit(limit)
            .do();

        return result.data?.Get?.Playlist || [];
    }

    async batchAddSongs(songsArray, batchSize = 100) {
        await this.initialize();

        const results = [];
        for (let i = 0; i < songsArray.length; i += batchSize) {
            const batch = songsArray.slice(i, i + batchSize);
            const batcher = this.client.batch.objectsBatcher();

            for (const songData of batch) {
                const descriptionParts = [
                    songData.title || '',
                    songData.artist || '',
                    songData.album || '',
                    Array.isArray(songData.genre) ? songData.genre.join(' ') : songData.genre || '',
                    songData.lyrics ? songData.lyrics.substring(0, 500) : ''
                ];

                const processedData = {
                    ...songData,
                    description: descriptionParts.filter(Boolean).join(' ')
                };

                batcher.withObject({
                    class: 'Song',
                    properties: processedData
                });
            }

            const batchResult = await batcher.do().catch(error => {
                console.error('Error occurred while processing batch:', error);
                return [];
            });
            results.push(...batchResult);

            console.log(`Batch ${Math.floor(i / batchSize) + 1} processed: ${batch.length} songs`);
        }

        return results;
    }

    async advancedSearchSongs(query, filters = {}, limit = 10) {
        await this.initialize();

        const whereFilter = {
            operator: 'And',
            operands: []
        };

        const audioFeaturePaths = [
            'acousticness',
            'danceability',
            'energy',
            'instrumentalness',
            'tempo',
            'valence'
        ];

        audioFeaturePaths.forEach(feature => {
            if (filters[`min${feature.charAt(0).toUpperCase() + feature.slice(1)}`] !== undefined) {
                whereFilter.operands.push({
                    operator: 'GreaterThanEqual',
                    path: ['audioFeatures', feature],
                    valueNumber: filters[`min${feature.charAt(0).toUpperCase() + feature.slice(1)}`]
                });
            }
            if (filters[`max${feature.charAt(0).toUpperCase() + feature.slice(1)}`] !== undefined) {
                whereFilter.operands.push({
                    operator: 'LessThanEqual',
                    path: ['audioFeatures', feature],
                    valueNumber: filters[`max${feature.charAt(0).toUpperCase() + feature.slice(1)}`]
                });
            }
        });

        let searchQuery = this.client.graphql.get()
        .withClassName('Song')
        .withFields(`spotifyId title artist album genre popularity audioFeatures { acousticness danceability energy instrumentalness tempo valence}`)
        .withLimit(limit);

        if (query && query.trim() !== '') {
            searchQuery = searchQuery.withNearText({ concepts: [query] });  
        }

        if (whereFilter.operands.length > 0) {
            searchQuery = searchQuery.withWhere(whereFilter);
        }

        const results = await searchQuery.withAdditional(['certainty']).do();

        return results.data?.Get?.Song || [];
    }

    async isReady() {
        try {
            const result = await this.client.misc.readyChecker().do();
            return result;
        } catch (error) {
            console.error('Error checking readiness:', error);
            return false;
        }
    }
}

const weaviateClient = new WeaviateClient();
module.exports = weaviateClient;