
(function () {
  "use strict";

  const H = window.HANOON = window.HANOON || {};
  const DB = H.Database;
  const Auth = H.Auth;

  const Community = {
    state: {
      posts: [],
      comments: {},
      loading: false,
      currentFilter: "all"
    },

    config: {
      pageSize: 30,
      maxPostLength: 5000,
      maxCommentLength: 1500
    },

    currentUser() {
      if (Auth && typeof Auth.getCurrentUser === "function") {
        return Auth.getCurrentUser();
      }

      if (window.firebase && firebase.auth) {
        return firebase.auth().currentUser;
      }

      return null;
    },

    userId() {
      const user = this.currentUser();
      return user ? user.uid : null;
    },

    async requireUser() {
      const user = this.currentUser();

      if (!user) {
        this.toast("سجّل دخولك الأول علشان تستخدم المجتمع", "warning");
        return null;
      }

      return user;
    },

    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    },

    toast(message, type = "info") {
      if (H.UI && typeof H.UI.toast === "function") {
        H.UI.toast(message, type);
        return;
      }

      if (typeof H.showToast === "function") {
        H.showToast(message, type);
        return;
      }

      console.info("[HANOON Community]", message);
    },

    collection(name) {
      if (!window.firebase || !firebase.firestore) {
        throw new Error("Firebase Firestore غير مهيأ");
      }

      const mapping = {
        posts: "communityPosts",
        comments: "comments",
        likes: "likes",
        follows: "follows",
        reports: "reports"
      };

      return firebase.firestore().collection(mapping[name] || name);
    },

    makeId(...parts) {
      return parts.map(part => String(part || "").replace(/[\/#?]/g, "_")).join("_");
    },

    async createPost(text, options = {}) {
      const user = await this.requireUser();
      if (!user) return null;

      const content = String(text || "").trim();

      if (!content) {
        this.toast("اكتب محتوى المنشور الأول", "warning");
        return null;
      }

      if (content.length > this.config.maxPostLength) {
        this.toast("المنشور أطول من المسموح", "warning");
        return null;
      }

      const post = {
        authorId: user.uid,
        authorName: user.displayName || "مستخدم HANOON",
        authorPhoto: user.photoURL || "",
        content,
        imageUrl: options.imageUrl || "",
        category: options.category || "general",
        likesCount: 0,
        commentsCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "published"
      };

      try {
        let result;

        if (DB && typeof DB.create === "function") {
          result = await DB.create("posts", post);
        } else {
          const ref = await this.collection("posts").add(post);
          result = { id: ref.id };
        }

        this.toast("تم نشر المنشور بنجاح", "success");
        await this.loadFeed();

        return result;
      } catch (error) {
        console.error("Create post error:", error);
        this.toast("حصلت مشكلة أثناء نشر المنشور", "error");
        throw error;
      }
    },

    async getPosts() {
      if (DB && typeof DB.getAll === "function") {
        return await DB.getAll("posts");
      }

      const snapshot = await this.collection("posts")
        .orderBy("createdAt", "desc")
        .limit(this.config.pageSize)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },

    async loadFeed(filter = this.state.currentFilter) {
      const container = document.querySelector("[data-community-feed]");
      this.state.currentFilter = filter;

      if (this.state.loading) return this.state.posts;

      this.state.loading = true;

      if (container) {
        container.innerHTML = '<div class="loading-state">جاري تحميل المنشورات...</div>';
      }

      try {
        let posts = await this.getPosts();

        posts = (posts || []).filter(post => post.status !== "deleted");

        if (filter !== "all") {
          posts = posts.filter(post => post.category === filter);
        }

        posts.sort((a, b) => {
          const first = this.toMillis(a.createdAt);
          const second = this.toMillis(b.createdAt);
          return second - first;
        });

        this.state.posts = posts;

        if (container) {
          container.innerHTML = posts.length
            ? posts.map(post => this.renderPost(post)).join("")
            : '<div class="empty-state">لسه مفيش منشورات هنا. كن أول من يشارك!</div>';
        }

        return posts;
      } catch (error) {
        console.error("Load community feed error:", error);

        if (container) {
          container.innerHTML = '<div class="error-state">تعذر تحميل المنشورات. حاول مرة تانية.</div>';
        }

        throw error;
      } finally {
        this.state.loading = false;
      }
    },

    toMillis(value) {
      if (!value) return 0;
      if (typeof value.toMillis === "function") return value.toMillis();
      if (value.seconds) return value.seconds * 1000;

      const date = new Date(value).getTime();
      return Number.isNaN(date) ? 0 : date;
    },

    formatDate(value) {
      const timestamp = this.toMillis(value);
      if (!timestamp) return "الآن";

      return new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(timestamp));
    },

    renderPost(post) {
      const id = this.escape(post.id);
      const author = this.escape(post.authorName || "مستخدم HANOON");
      const content = this.escape(post.content || "");
      const photo = this.escape(post.authorPhoto || "");
      const image = this.escape(post.imageUrl || "");
      const userId = this.userId();

      const ownPost = userId && userId === post.authorId;

      const avatar = photo
        ? `<img src="${photo}" alt="${author}" loading="lazy">`
        : `<span>${this.escape(author.charAt(0) || "ه")}</span>`;

      return `
        <article class="community-post" data-post-id="${id}">
          <header class="post-header">
            <div class="post-author">
              <div class="avatar">${avatar}</div>
              <div class="post-author-info">
                <strong>${author}</strong>
                <time>${this.formatDate(post.createdAt)}</time>
              </div>
            </div>

            <div class="post-menu">
              ${ownPost
                ? `<button type="button" data-delete-post="${id}" aria-label="حذف المنشور">حذف</button>`
                : `<button type="button" data-report-post="${id}" aria-label="الإبلاغ عن المنشور">إبلاغ</button>`
              }
            </div>
          </header>

          <div class="post-content">${content.replace(/\n/g, "<br>")}</div>

          ${image ? `
            <div class="post-image">
              <img src="${image}" alt="صورة المنشور" loading="lazy">
            </div>
          ` : ""}

          <div class="post-stats">
            <span data-like-count="${id}">${Number(post.likesCount || 0)} إعجاب</span>
            <span data-comment-count="${id}">${Number(post.commentsCount || 0)} تعليق</span>
          </div>

          <div class="post-actions">
            <button type="button" data-like-post="${id}">إعجاب</button>
            <button type="button" data-show-comments="${id}">التعليقات</button>
          </div>

          <section class="post-comments" data-comments-box="${id}" hidden>
            <div class="comments-list" data-comments-list="${id}"></div>

            <form data-comment-form="${id}">
              <input
                type="text"
                name="comment"
                maxlength="${this.config.maxCommentLength}"
                placeholder="اكتب تعليقك..."
                required
              >
              <button type="submit">إرسال</button>
            </form>
          </section>
        </article>
      `;
    },

    async deletePost(postId) {
      const user = await this.requireUser();
      if (!user) return false;

      const post = this.state.posts.find(item => item.id === postId);

      if (!post) {
        this.toast("المنشور غير موجود", "warning");
        return false;
      }

      if (post.authorId !== user.uid) {
        this.toast("لا يمكنك حذف منشور شخص آخر", "error");
        return false;
      }

      if (!window.confirm("هل تريد حذف المنشور؟")) return false;

      try {
        await this.collection("posts").doc(postId).update({
          status: "deleted",
          deletedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        this.toast("تم حذف المنشور", "success");
        await this.loadFeed();
        return true;
      } catch (error) {
        console.error("Delete post error:", error);
        this.toast("تعذر حذف المنشور", "error");
        throw error;
      }
    },

    async toggleLike(postId) {
      const user = await this.requireUser();
      if (!user) return false;

      const db = firebase.firestore();
      const likeId = this.makeId(user.uid, postId);

      const likeRef = this.collection("likes").doc(likeId);
      const postRef = this.collection("posts").doc(postId);

      try {
        const liked = await db.runTransaction(async transaction => {
          const likeDoc = await transaction.get(likeRef);
          const postDoc = await transaction.get(postRef);

          if (!postDoc.exists || postDoc.data().status === "deleted") {
            throw new Error("المنشور غير موجود");
          }

          const currentCount = Number(postDoc.data().likesCount || 0);

          if (likeDoc.exists) {
            transaction.delete(likeRef);
            transaction.update(postRef, {
              likesCount: Math.max(0, currentCount - 1)
            });
            return false;
          }

          transaction.set(likeRef, {
            userId: user.uid,
            postId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          transaction.update(postRef, {
            likesCount: currentCount + 1
          });

          return true;
        });

        const post = this.state.posts.find(item => item.id === postId);

        if (post) {
          post.likesCount = Math.max(
            0,
            Number(post.likesCount || 0) + (liked ? 1 : -1)
          );
        }

        const count = document.querySelector(`[data-like-count="${CSS.escape(postId)}"]`);
        if (count && post) {
          count.textContent = `${post.likesCount} إعجاب`;
        }

        this.toast(liked ? "أضفت إعجابك" : "أزلت إعجابك", "success");
        return liked;
      } catch (error) {
        console.error("Toggle like error:", error);
        this.toast("تعذر تسجيل الإعجاب", "error");
        throw error;
      }
    },

    async addComment(postId, text) {
      const user = await this.requireUser();
      if (!user) return null;

      const content = String(text || "").trim();

      if (!content || content.length > this.config.maxCommentLength) {
        this.toast("اكتب تعليقًا صحيحًا", "warning");
        return null;
      }

      const db = firebase.firestore();
      const postRef = this.collection("posts").doc(postId);
      const commentRef = this.collection("comments").doc();

      try {
        await db.runTransaction(async transaction => {
          const postDoc = await transaction.get(postRef);

          if (!postDoc.exists || postDoc.data().status === "deleted") {
            throw new Error("المنشور غير موجود");
          }

          transaction.set(commentRef, {
            postId,
            authorId: user.uid,
            authorName: user.displayName || "مستخدم HANOON",
            authorPhoto: user.photoURL || "",
            content,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: "published"
          });

          transaction.update(postRef, {
            commentsCount: Number(postDoc.data().commentsCount || 0) + 1
          });
        });

        const post = this.state.posts.find(item => item.id === postId);
        if (post) post.commentsCount = Number(post.commentsCount || 0) + 1;

        const count = document.querySelector(`[data-comment-count="${CSS.escape(postId)}"]`);
        if (count && post) {
          count.textContent = `${post.commentsCount} تعليق`;
        }

        this.toast("تم إضافة التعليق", "success");
        await this.loadComments(postId);

        return commentRef.id;
      } catch (error) {
        console.error("Add comment error:", error);
        this.toast("تعذر إضافة التعليق", "error");
        throw error;
      }
    },

    async loadComments(postId) {
      const container = document.querySelector(
        `[data-comments-list="${CSS.escape(postId)}"]`
      );

      try {
        const snapshot = await this.collection("comments")
          .where("postId", "==", postId)
          .where("status", "==", "published")
          .limit(100)
          .get();

        const comments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        comments.sort((a, b) => this.toMillis(a.createdAt) - this.toMillis(b.createdAt));

        this.state.comments[postId] = comments;

        if (container) {
          container.innerHTML = comments.length
            ? comments.map(comment => `
                <div class="post-comment" data-comment-id="${this.escape(comment.id)}">
                  <strong>${this.escape(comment.authorName || "مستخدم")}</strong>
                  <p>${this.escape(comment.content || "")}</p>
                  <time>${this.formatDate(comment.createdAt)}</time>
                  ${comment.authorId === this.userId()
                    ? `<button type="button" data-delete-comment="${this.escape(comment.id)}">حذف</button>`
                    : ""
                  }
                </div>
              `).join("")
            : '<p class="empty-comments">لا توجد تعليقات حتى الآن</p>';
        }

        return comments;
      } catch (error) {
        console.error("Load comments error:", error);
        if (container) {
          container.textContent = "تعذر تحميل التعليقات";
        }
        throw error;
      }
    },

    async deleteComment(commentId) {
      const user = await this.requireUser();
      if (!user) return false;

      const ref = this.collection("comments").doc(commentId);

      try {
        const result = await firebase.firestore().runTransaction(async transaction => {
          const commentDoc = await transaction.get(ref);

          if (!commentDoc.exists) return null;

          const comment = commentDoc.data();

          if (comment.authorId !== user.uid) {
            throw new Error("لا يمكنك حذف تعليق شخص آخر");
          }

          const postRef = this.collection("posts").doc(comment.postId);
          const postDoc = await transaction.get(postRef);

          transaction.update(ref, {
            status: "deleted",
            deletedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          if (postDoc.exists) {
            transaction.update(postRef, {
              commentsCount: Math.max(
                0,
                Number(postDoc.data().commentsCount || 0) - 1
              )
            });
          }

          return comment.postId;
        });

        if (result) await this.loadComments(result);

        this.toast("تم حذف التعليق", "success");
        return true;
      } catch (error) {
        console.error("Delete comment error:", error);
        this.toast(error.message || "تعذر حذف التعليق", "error");
        return false;
      }
    },

    async toggleFollow(targetUserId) {
      const user = await this.requireUser();
      if (!user) return false;

      if (!targetUserId || targetUserId === user.uid) {
        this.toast("لا يمكنك متابعة نفسك", "warning");
        return false;
      }

      const db = firebase.firestore();
      const followId = this.makeId(user.uid, targetUserId);
      const followRef = this.collection("follows").doc(followId);

      try {
        const following = await db.runTransaction(async transaction => {
          const doc = await transaction.get(followRef);

          if (doc.exists) {
            transaction.delete(followRef);
            return false;
          }

          transaction.set(followRef, {
            followerId: user.uid,
            followingId: targetUserId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          return true;
        });

        this.toast(following ? "بدأت متابعة المستخدم" : "ألغيت المتابعة", "success");
        return following;
      } catch (error) {
        console.error("Follow error:", error);
        this.toast("تعذرت عملية المتابعة", "error");
        throw error;
      }
    },

    async reportPost(postId, reason = "محتوى غير مناسب") {
      const user = await this.requireUser();
      if (!user) return false;

      const cleanReason = String(reason || "").trim();

      try {
        await this.collection("reports").add({
          reporterId: user.uid,
          targetType: "post",
          targetId: postId,
          reason: cleanReason,
          status: "pending",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        this.toast("تم إرسال البلاغ للمراجعة", "success");
        return true;
      } catch (error) {
        console.error("Report post error:", error);
        this.toast("تعذر إرسال البلاغ", "error");
        throw error;
      }
    },

    bindEvents() {
      if (this._eventsBound) return;
      this._eventsBound = true;

      document.addEventListener("submit", async event => {
        const postForm = event.target.closest("[data-create-post-form]");
        const commentForm = event.target.closest("[data-comment-form]");

        if (postForm) {
          event.preventDefault();

          const input = postForm.querySelector(
            '[name="content"], textarea, [data-post-content]'
          );

          const imageInput = postForm.querySelector('[name="imageUrl"]');

          try {
            const result = await this.createPost(input ? input.value : "", {
              imageUrl: imageInput ? imageInput.value.trim() : ""
            });

            if (result) postForm.reset();
          } catch (_) {
            // رسالة الخطأ تظهر من createPost.
          }
        }

        if (commentForm) {
          event.preventDefault();

          const postId = commentForm.getAttribute("data-comment-form");
          const input = commentForm.querySelector('[name="comment"]');

          try {
            const result = await this.addComment(postId, input ? input.value : "");
            if (result) commentForm.reset();
          } catch (_) {
            // رسالة الخطأ تظهر من addComment.
          }
        }
      });

      document.addEventListener("click", async event => {
        const likeButton = event.target.closest("[data-like-post]");
        const commentsButton = event.target.closest("[data-show-comments]");
        const deletePostButton = event.target.closest("[data-delete-post]");
        const reportButton = event.target.closest("[data-report-post]");
        const deleteCommentButton = event.target.closest("[data-delete-comment]");
        const filterButton = event.target.closest("[data-community-filter]");

        try {
          if (likeButton) {
            await this.toggleLike(likeButton.getAttribute("data-like-post"));
          }

          if (commentsButton) {
            const postId = commentsButton.getAttribute("data-show-comments");
            const box = document.querySelector(
              `[data-comments-box="${CSS.escape(postId)}"]`
            );

            if (box) {
              box.hidden = !box.hidden;
              if (!box.hidden) await this.loadComments(postId);
            }
          }

          if (deletePostButton) {
            await this.deletePost(deletePostButton.getAttribute("data-delete-post"));
          }

          if (reportButton) {
            const postId = reportButton.getAttribute("data-report-post");
            const reason = window.prompt("اكتب سبب الإبلاغ عن المنشور:");

            if (reason && reason.trim()) {
              await this.reportPost(postId, reason);
            }
          }

          if (deleteCommentButton) {
            await this.deleteComment(
              deleteCommentButton.getAttribute("data-delete-comment")
            );
          }

          if (filterButton) {
            const filter = filterButton.getAttribute("data-community-filter");
            await this.loadFeed(filter || "all");
          }
        } catch (error) {
          console.error("Community action error:", error);
        }
      });
    },

    init() {
      this.bindEvents();

      if (document.querySelector("[data-community-feed]")) {
        this.loadFeed().catch(error => {
          console.error("Community initialization error:", error);
        });
      }
    }
  };

  H.Community = Community;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Community.init());
  } else {
    Community.init();
  }
})();
