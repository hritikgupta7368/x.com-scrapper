const config = {
    selectors: {
        article: 'article[role="article"]',
        postText: '[data-testid="tweetText"]',
        showMoreLink: '[data-testid="tweet-text-show-more-link"]',
        postLink: 'a[role="link"][href*="/status/"]',
        repostHeader: '[data-testid="socialContext"]',
    },
    scrollDelay: () => 1500 + Math.random() * 2500,
    scrollAmount: () => 150 + Math.random() * 350,
    maxUnchangedScrolls: 15,
    startTime: "2025-01-16 09:03:45",
    user: "hritikgupta7368"
};

class EnhancedScraper {
    constructor() {
        this.posts = new Map();
        this.isRunning = false;
        this.unchangedCount = 0;
        this.startTime = new Date();
        this.lastPostCount = 0;
        this.processingPost = false;
        this.visitedPosts = new Set();
    }

    async start() {
        this.isRunning = true;
        this.startTime = new Date();
        console.log('%c🚀 Starting post collection...', 'color: #00ff00; font-weight: bold;');
        this.scroll();
    }

    stop() {
        this.isRunning = false;
        this.saveData();
        this.showStats();
        console.log('%c📥 Collection stopped. Data saved.', 'color: #ff9900; font-weight: bold;');
    }

    async fetchFullPost(url) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return doc.querySelector(config.selectors.postText)?.textContent?.trim() || null;
        } catch (error) {
            console.warn('Error fetching full post:', error);
            return null;
        }
    }

    async handleShowMore(article, currentText) {
        try {
            const postUrl = article.querySelector(config.selectors.postLink)?.href;
            if (!postUrl || this.visitedPosts.has(postUrl)) return currentText;

            const fullText = await this.fetchFullPost(postUrl);
            if (fullText) {
                this.visitedPosts.add(postUrl);
                return fullText;
            }
            return currentText;
        } catch (error) {
            console.warn('Error handling show more:', error);
            return currentText;
        }
    }

    extractPostUrl(article) {
        try {
            const links = Array.from(article.querySelectorAll('a'));
            const statusLink = links.find(link => link.href && link.href.includes('/status/'));
            return statusLink?.href || null;
        } catch (error) {
            console.warn('Error extracting post URL:', error);
            return null;
        }
    }

    async processPost(article) {
        try {
            // Check if already processed
            if (article.getAttribute('data-processed')) return null;

            // Get the post text element
            const tweetTextElement = article.querySelector(config.selectors.postText);
            if (!tweetTextElement) return null;

            // Get initial text
            let postText = tweetTextElement.textContent.trim();
            if (!postText) return null;

            // Check for show more and handle it
            const hasShowMore = article.querySelector(config.selectors.showMoreLink);
            if (hasShowMore) {
                const expandedText = await this.handleShowMore(article, postText);
                if (expandedText && expandedText.length > postText.length) {
                    postText = expandedText;
                }
            }

            // Get other post data
            const timeElement = article.querySelector('time');
            const postUrl = this.extractPostUrl(article);
            const repostInfo = article.querySelector(config.selectors.repostHeader)?.textContent?.trim();

            // Mark as processed
            article.setAttribute('data-processed', 'true');

            // Return post data
            return {
                text: postText,
                url: postUrl,
                repost_info: repostInfo || null,
                post_timestamp: timeElement?.getAttribute('datetime') || new Date().toISOString(),
                collected_at: new Date().toISOString(),
                collected_by: config.user,
                collection_session_start: config.startTime,
                is_expanded: hasShowMore ? true : false,
                text_length: postText.length
            };

        } catch (error) {
            console.warn('Error processing post:', error);
            return null;
        }
    }

    async collectPosts() {
        if (this.processingPost) return 0;
        this.processingPost = true;

        try {
            const articles = document.querySelectorAll(config.selectors.article);
            let newCount = 0;

            for (const article of articles) {
                const postData = await this.processPost(article);
                if (postData) {
                    const id = `${postData.url || postData.text.substring(0, 40)}_${postData.post_timestamp}`;
                    if (!this.posts.has(id)) {
                        this.posts.set(id, postData);
                        newCount++;
                        console.log(`📝 Collected post: ${postData.text.substring(0, 50)}...`);
                    }
                }
            }

            if (newCount > 0) {
                console.log(`📌 Found ${newCount} new posts. Total: ${this.posts.size}`);
            }

            if (newCount === 0) {
                this.unchangedCount++;
            } else {
                this.unchangedCount = 0;
            }

            return newCount;

        } catch (error) {
            console.error('Error collecting posts:', error);
            return 0;
        } finally {
            this.processingPost = false;
        }
    }

    async scroll() {
        if (!this.isRunning) return;

        try {
            const newPosts = await this.collectPosts();

            if (this.unchangedCount >= config.maxUnchangedScrolls) {
                console.log('%c⚠️ No new content found after multiple scrolls', 'color: #ff9900');
                this.stop();
                return;
            }

            window.scrollBy({
                top: config.scrollAmount(),
                behavior: 'smooth'
            });

            if (this.posts.size % 50 === 0 && this.posts.size !== this.lastPostCount) {
                this.saveData();
                this.lastPostCount = this.posts.size;
            }

            setTimeout(() => this.scroll(), config.scrollDelay());

        } catch (error) {
            console.error('Error during scroll:', error);
            this.stop();
        }
    }

    saveData() {
        if (this.posts.size === 0) return;

        try {
            const data = Array.from(this.posts.values());
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `x_posts_${config.user}_${timestamp}.json`;
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();

            console.log(`💾 Saved ${data.length} posts to ${filename}`);
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    showStats() {
        const endTime = new Date();
        const duration = (endTime - this.startTime) / 1000;
        
        console.log('\n📊 Collection Statistics 📊');
        console.log('==========================');
        console.log(`📝 Total posts collected: ${this.posts.size}`);
        console.log(`⏱️ Duration: ${duration.toFixed(2)} seconds`);
        console.log(`⚡ Collection rate: ${(this.posts.size / duration).toFixed(2)} posts/second`);
        console.log(`🔄 Expanded posts: ${this.visitedPosts.size}`);
        console.log('==========================\n');
    }
}

// Create scraper instance
const scraper = new EnhancedScraper();

// Control functions
const startScraping = () => scraper.start();
const stopScraping = () => scraper.stop();

// Start automatically
startScraping();