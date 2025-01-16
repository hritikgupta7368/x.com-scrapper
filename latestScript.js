const config = {
    selectors: {
        article: 'article[role="article"]',
        postText: '[data-testid="tweetText"]',
        showMoreLink: '[data-testid="tweet-text-show-more-link"]',
        postLink: 'a[role="link"][href*="/status/"]',
        repostHeader: '[data-testid="socialContext"]',
        mainTweet: 'article[data-testid="tweet"]' // Selector for main tweet in individual post view
    },
    scrollDelay: () => 1500 + Math.random() * 2500,
    scrollAmount: () => 150 + Math.random() * 350,
    maxUnchangedScrolls: 15,
    startTime: "2025-01-16 10:11:27",
    user: "hritikgupta7368",
    maxRetries: 3 // Maximum number of retries for failed expansions
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
    createIframe() {
        const iframe = document.createElement('iframe');
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.position = 'fixed';
        iframe.style.top = '-999px';
        iframe.style.left = '-999px';
        return iframe;
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

    async openPostInNewTab(url) {
        return new Promise((resolve) => {
            const newTab = window.open(url, '_blank');
            if (!newTab) {
                console.error('❌ Failed to open new tab');
                resolve(null);
                return;
            }

            let retryCount = 0;
            const maxRetries = 10; // 10 attempts, 500ms apart = 5 seconds max
            
            const checkContent = () => {
                try {
                    if (newTab.closed) {
                        console.warn('⚠️ Tab was closed prematurely');
                        resolve(null);
                        return;
                    }

                    if (retryCount >= maxRetries) {
                        console.error('❌ Timeout waiting for post content');
                        newTab.close();
                        resolve(null);
                        return;
                    }

                    const mainTweet = newTab.document.querySelector(config.selectors.mainTweet);
                    const postText = mainTweet?.querySelector(config.selectors.postText);

                    if (postText) {
                        const text = postText.textContent.trim();
                        newTab.close();
                        resolve(text);
                    } else {
                        retryCount++;
                        setTimeout(checkContent, 500);
                    }
                } catch (error) {
                    if (error.name === 'SecurityError') {
                        // Wait a bit longer for page to load if we hit a security error
                        retryCount++;
                        setTimeout(checkContent, 500);
                    } else {
                        console.error('❌ Error reading post content:', error);
                        newTab.close();
                        resolve(null);
                    }
                }
            };

            setTimeout(checkContent, 1000); // Initial delay to let page start loading
        });
    }

   
    async getFullPostContent(url) {
        return new Promise((resolve) => {
            const iframe = this.createIframe();
            let timeoutId;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (iframe.parentNode) iframe.remove();
            };

            const handleLoad = () => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const postText = iframeDoc.querySelector(config.selectors.postText);
                    const fullText = postText ? postText.textContent.trim() : null;
                    cleanup();
                    resolve(fullText);
                } catch (error) {
                    console.warn('Error reading iframe content:', error);
                    cleanup();
                    resolve(null);
                }
            };

            timeoutId = setTimeout(() => {
                console.warn('Iframe loading timed out');
                cleanup();
                resolve(null);
            }, config.iframeTimeout);

            iframe.onload = handleLoad;
            iframe.src = url;
            document.body.appendChild(iframe);
        });
    }

    
    async handleShowMore(article) {
        try {
            const postUrl = article.querySelector(config.selectors.postLink)?.href;
            if (!postUrl || this.visitedPosts.has(postUrl)) return null;

            console.log(`📥 Opening post in new tab: ${postUrl}`);
            const fullText = await this.openPostInNewTab(postUrl);
            
            if (fullText) {
                this.visitedPosts.add(postUrl);
                console.log(`✅ Successfully retrieved full post (${fullText.length} chars)`);
                return fullText;
            } else {
                console.warn('⚠️ Failed to retrieve full post content');
                return null;
            }
        } catch (error) {
            console.error('❌ Error handling show more:', error);
            return null;
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
            if (article.getAttribute('data-processed')) return null;

            let postText = '';
            const tweetTextElement = article.querySelector(config.selectors.postText);
            const showMoreElement = article.querySelector(config.selectors.showMoreLink);
            
            if (tweetTextElement) {
                postText = tweetTextElement.textContent.trim();
                
                if (showMoreElement) {
                    console.log('🔍 Found "Show more" link, attempting to expand...');
                    const fullText = await this.handleShowMore(article);
                    if (fullText && fullText.length > postText.length) {
                        console.log('📈 Post expanded successfully');
                        postText = fullText;
                    } else {
                        console.warn('⚠️ Failed to expand post, using original text');
                    }
                }
            }

            if (!postText) {
                console.warn('⚠️ No post text found');
                return null;
            }

            // Get other post data
            const timeElement = article.querySelector('time');
            const postUrl = article.querySelector(config.selectors.postLink)?.href;
            const repostInfo = article.querySelector(config.selectors.repostHeader)?.textContent?.trim();

            // Mark as processed
            article.setAttribute('data-processed', 'true');

            return {
                text: postText,
                url: postUrl,
                repost_info: repostInfo || null,
                post_timestamp: timeElement?.getAttribute('datetime') || new Date().toISOString(),
                collected_at: new Date().toISOString(),
                collected_by: config.user,
                collection_session_start: config.startTime,
                is_expanded: showMoreElement ? true : false,
                text_length: postText.length,
                expanded_length: postText.length > 0 ? postText.length : 0
            };

        } catch (error) {
            console.error('❌ Error processing post:', error);
            this.stop(); // Stop the script on critical errors
            return null;
        }
    }


    async collectPosts() {
        if (this.processingPost) return 0;
        this.processingPost = true;

        try {
            const articles = Array.from(document.querySelectorAll(config.selectors.article));
            let newCount = 0;

            // Process posts sequentially
            for (const article of articles) {
                const postData = await this.processPost(article);
                if (postData) {
                    const id = `${postData.url || postData.text.substring(0, 40)}_${postData.post_timestamp}`;
                    if (!this.posts.has(id)) {
                        this.posts.set(id, postData);
                        newCount++;
                        console.log(`📝 Collected post ${newCount}: ${postData.text.substring(0, 50)}...`);
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
            console.error('❌ Fatal error collecting posts:', error);
            this.stop(); // Stop the script on critical errors
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