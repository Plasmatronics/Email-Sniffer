export const mockHTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<body>
    <div style="isolation:isolate;background:inherit">
        <script>
            ((e, i, s, u, m, a, l, h) => {
    let d = document.documentElement, w = ["light", "dark"];
    function p(n) {
        (Array.isArray(e) ? e : [e]).forEach((y) => {
            let k = y === "class", S = k && a ? m.map((f) => a[f] || f) : m;
            k ? (d.classList.remove(...S), d.classList.add(a && a[n] ? a[n] : n)) : d.setAttribute(y, n);
        }), R(n);
    }
    function R(n) {
        h && w.includes(n) && (d.style.colorScheme = n);
    }
    function c() {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    if (u) p(u);
    else try {
        let n = localStorage.getItem(i) || s;
        p(l && n === "system" ? c() : n);
    } catch (n) {}
})("data-theme","website-theme","dark","dark",["dark","light","glass"],null,true,true)
        </script><!--$--><!--/$-->
        <section aria-label="Notifications alt+T" tabindex="-1" aria-live="polite" aria-relevant="additions text"
            aria-atomic="false"></section><a class="LSqk9q_root" href="#skip-nav">Skip to content →</a>
        <div class="_5l06ia_container">
            <div data-header="">
                <header class="TZTsQG_header TZTsQG_header">
                    <nav class="TZTsQG_menuRoot">
                        <div class="TZTsQG_innerWrapper">
                            <ul aria-label="Site navigation" class="TZTsQG_list">
                                <li class="TZTsQG_logoItem TZTsQG_item">
                                    <div style="-webkit-touch-callout:none;display:flex"><a href="/homepage"
                                            aria-label="Navigate to home" class="TZTsQG_logoLink I_mUeq_root"
                                            rel="noopener"><svg height="22" viewBox="0 0 400 100" fill="currentColor"
                                                size="22" color="currentColor" aria-label="Linear">
                                                <path
                                                    d="M12.927 16.371a1.47 1.47 0 0 0 .061 2.027l68.595 68.594c.555.555 1.446.59 2.026.062 10.058-9.152 16.372-22.348 16.372-37.018C99.98 22.402 77.579 0 49.945 0c-14.67 0-27.866 6.313-37.018 16.371M4.353 29.39a1.47 1.47 0 0 0 .309 1.648L68.943 95.32c.434.434 1.09.562 1.648.308a50 50 0 0 0 4.335-2.227c.834-.482.962-1.62.28-2.3L8.882 24.773c-.68-.68-1.818-.553-2.3.281a50 50 0 0 0-2.228 4.334m-3.9 18.407a1.48 1.48 0 0 1-.432-1.14q.2-2.986.74-5.866c.215-1.15 1.62-1.55 2.448-.722l56.703 56.704c.828.827.429 2.233-.722 2.448a50 50 0 0 1-5.865.74 1.48 1.48 0 0 1-1.14-.433zm3.48 13.963c-1.033-1.033-2.7-.143-2.322 1.268C6.221 80.22 19.761 93.76 36.954 98.37c1.41.379 2.3-1.289 1.268-2.322z">
                                                </path>
                                                <path fill-rule="evenodd" clip-rule="evenodd"
                                                    d="M201.602 27.536c3.587 0 6.494-2.918 6.494-6.518s-2.907-6.517-6.494-6.517-6.493 2.918-6.493 6.518 2.907 6.517 6.493 6.517m-55.621 56.84v-69.87h11.54v59.648h31.115v10.223zm82.136-28.511v28.51h-11.166V34.857h11.026v8.487l.14-.094q1.682-3.986 5.42-6.659 3.737-2.72 9.531-2.72 5.139 0 9.344 2.299 4.204 2.25 6.727 6.611 2.523 4.362 2.523 10.692v30.903h-11.166V55.02q0-5.628-2.99-8.535-2.943-2.954-7.896-2.954-3.177 0-5.793 1.313t-4.158 4.032-1.542 6.988M329.222 83.53q3.831 1.642 8.783 1.642 4.065 0 6.961-1.032 2.898-1.078 4.766-2.86 1.915-1.782 3.037-3.893h.187v6.988h10.699V50.283q0-3.61-1.402-6.612-1.401-3-4.065-5.205-2.616-2.205-6.354-3.376-3.737-1.22-8.409-1.22-6.4 0-11.073 2.205-4.625 2.157-7.242 5.814t-2.85 8.254h10.793a7.15 7.15 0 0 1 1.495-3.846q1.308-1.687 3.551-2.626 2.242-.984 5.186-.984t4.999.984q2.102.986 3.223 2.673 1.122 1.689 1.122 3.94v.375q0 1.687-1.168 2.485-1.122.797-3.831 1.172-2.664.375-7.289.891a59 59 0 0 0-7.288 1.266q-3.504.844-6.261 2.486a12.25 12.25 0 0 0-4.298 4.36q-1.588 2.72-1.588 6.988 0 4.923 2.242 8.253 2.243 3.282 6.074 4.97m18.081-8.3q-2.71 1.454-6.681 1.454-4.019 0-6.401-1.688-2.383-1.736-2.383-4.736 0-2.345 1.308-3.799 1.356-1.454 3.551-2.297t4.765-1.173q1.869-.281 3.645-.562 1.775-.329 3.317-.61 1.542-.329 2.616-.657 1.122-.328 1.635-.703v5.533q0 2.908-1.355 5.346-1.308 2.392-4.017 3.892m26.094 9.145v-49.52h10.745v8.16h.141q1.354-4.22 4.251-6.425 2.943-2.25 7.709-2.25 1.169 0 2.102.093.982.048 1.636.094V44.61a41 41 0 0 0-2.149-.234 36 36 0 0 0-3.271-.14q-2.756 0-5.046 1.265-2.29 1.267-3.644 3.892-1.308 2.58-1.308 6.518v28.465zm-177.401 0v-49.52h11.166v49.52zm84.238-2.204q5.373 3.33 12.755 3.329 5.7 0 10.372-2.063 4.719-2.11 7.849-5.768 3.13-3.705 4.065-8.535h-10.512a10.1 10.1 0 0 1-2.29 3.892q-1.541 1.642-3.877 2.58-2.337.937-5.42.937-4.158 0-7.148-1.875-2.943-1.876-4.485-5.205-1.4-3.065-1.529-6.94h35.915V59.52q0-5.721-1.682-10.41-1.682-4.735-4.766-8.16-3.082-3.47-7.428-5.345-4.298-1.875-9.578-1.876-6.867 0-12.147 3.33t-8.27 9.19-2.99 13.412q0 7.503 2.897 13.364 2.897 5.815 8.269 9.145m23.501-32.779q-1.542-3.189-4.392-4.923-2.85-1.736-6.728-1.736-3.831 0-6.681 1.736-2.802 1.734-4.391 4.923-1.134 2.31-1.434 5.252h25.059q-.3-2.942-1.433-5.252">
                                                </path>
                                            </svg></a></div>
                                </li>
                                <li class="TZTsQG_rightSideWrapper">
                                    <ul class="TZTsQG_navItems">
                                        <li class="hide-tablet TZTsQG_item">
                                            <button type="button" aria-disabled="false" tabindex="0" aria-expanded="false" data-base-ui-navigation-menu-trigger="" class="TZTsQG_anchor TZTsQG_trigger hCgVwa_reset-button">Product</button>
                                        </li>
                                        <li class="hide-tablet TZTsQG_item">
                                            <button type="button" aria-disabled="false" tabindex="0" aria-expanded="false" data-base-ui-navigation-menu-trigger="" class="TZTsQG_anchor TZTsQG_trigger hCgVwa_reset-button">Resources</button>
                                        </li>
                                        <li class="hide-tablet TZTsQG_item"><a href="/customers"
                                                class="TZTsQG_anchor I_mUeq_root" rel="noopener">Customers</a></li>
                                        <li class="hide-tablet TZTsQG_item"><a href="/pricing"
                                                class="TZTsQG_anchor I_mUeq_root" rel="noopener">Pricing</a></li>
                                        <li class="hide-laptop TZTsQG_item"><a href="/now"
                                                class="TZTsQG_anchor I_mUeq_root" rel="noopener">Now</a></li>
                                        <li class="hide-tablet TZTsQG_item"><a href="/contact" data-active=""
                                                class="TZTsQG_anchor I_mUeq_root" rel="noopener">Contact</a></li>
                                    </ul>
                                    <div style="flex:1"></div>
                                    <div class="TZTsQG_navDivider hide-tablet"></div>
                                    <div style="flex:1"></div>
                                    <ul class="TZTsQG_buttons">
                                        <li data-show="logged-in" class="hide-mobile TZTsQG_buttonItem TZTsQG_item"><a
                                                href="/docs" class="TZTsQG_anchor I_mUeq_root" rel="noopener">Docs</a>
                                        </li>
                                        <li data-show="logged-in" class="TZTsQG_buttonItem TZTsQG_item">
                                            <span id="header-tooltip-open-app" data-base-ui-tooltip-trigger=""><a href="/login" draggable="false" role="button" type="button" class="S36ykG_root S36ykG_variant-invert S36ykG_size-small S36ykG_variant I_mUeq_root" rel="noopener">Open app</a></span>
                                        </li>
                                        <li data-hide="logged-in" class="TZTsQG_buttonItem TZTsQG_item">
                                            <span id="header-tooltip-login" data-base-ui-tooltip-trigger=""><a href="/login" draggable="false" class="TZTsQG_anchor I_mUeq_root" rel="noopener">Log in</a></span>
                                        </li>
                                        <li data-hide="logged-in" class="TZTsQG_buttonItem TZTsQG_item"><a
                                                href="/signup" draggable="false"
                                                class="S36ykG_root S36ykG_variant-invert S36ykG_size-small S36ykG_variant I_mUeq_root"
                                                rel="noopener">Sign up</a></li>
                                    </ul>
                                </li>
                                <li class="TZTsQG_mobileItem TZTsQG_item">
                                    <button type="button" aria-disabled="false" data-base-ui-click-trigger="" id="base-ui-_R_1qvjqcplei_" aria-haspopup="dialog" aria-expanded="false" class="TZTsQG_mobileMenuTrigger hCgVwa_reset-button"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="7.5" width="14" height="1" rx="0.5" style="transform-origin:center;transition:160ms var(--ease-out-quad);transform:translateY(-3.5px)"></rect><rect x="1" y="7.5" width="14" height="1" rx="0.5" style="transform-origin:center;transition:160ms var(--ease-out-quad);transform:translateY(3.5px)"></rect></svg></button>
                                </li>
                            </ul>
                        </div>
                    </nav>
                </header>
            </div>
            <main class="_5l06ia_content">
                <div id="skip-nav"></div>
                <div class="_7bwwmq_root _7bwwmq_homepage">
                    <div class="Fzcv4W_inset">
                        <header class="Jbvjba_root" data-tabs="false">
                            <div class="ImRUSq_root ImRUSq_align-center ImRUSq_justify-space-between">
                                <h1 class="sc-KOGVz fqiDfk Fzcv4W_insetLarge Jbvjba_title">How can we help?</h1>
                            </div>
                        </header>
                    </div>
                    <nav>
                        <ul class="rWdRxW_cards">
                            <li><a href="/contact/sales" class="rWdRxW_card I_mUeq_root"
                                    rel="noopener"><span class="rWdRxW_cardCaption"><h2 class="sc-KOGVz iESTYJ">Sales</h2><p class="sc-KOGVz brrRtc">Speak to our sales team about plans, pricing, enterprise contracts, or request a demo.</p></span><span class="qqCMlG_root rWdRxW_cardAction"><span class="sc-KOGVz TxVeW qqCMlG_label">Talk to sales</span><span class="sc-KOGVz TxVeW qqCMlG_suffix" style="margin-left:8px"><span>→</span></span></span></a>
                            </li>
                            <li><a href="/contact/support" class="rWdRxW_card I_mUeq_root"
                                    rel="noopener"><span class="rWdRxW_cardCaption"><h2 class="sc-KOGVz iESTYJ">Support</h2><p class="sc-KOGVz brrRtc">We are here to help. Ask product questions, <br class="hide-mobile"/>report problems, or leave feedback.</p></span><span class="qqCMlG_root rWdRxW_cardAction"><span class="sc-KOGVz TxVeW qqCMlG_label">Contact support</span><span class="sc-KOGVz TxVeW qqCMlG_suffix" style="margin-left:8px"><span>→</span></span></span></a>
                            </li>
                            <li class="hide-mobile">
                                <button type="button" tabindex="0" class="rWdRxW_card S36ykG_root S36ykG_size-default"><span class="rWdRxW_cardCaption"><span class="sc-KOGVz iESTYJ">Other inquiries</span><span class="sc-KOGVz brrRtc">Get in touch with our team for press inquiries, partnerships, or other questions.</span></span><span class="qqCMlG_root rWdRxW_cardAction"><span class="sc-KOGVz TxVeW qqCMlG_label">hello@linear.app</span><span class="sc-KOGVz TxVeW qqCMlG_suffix" style="margin-left:8px"><span>​</span></span></span></button>
                            </li>
                        </ul>
                    </nav>
                    <div class="hide-mobile _5mGmSq_root" style="--height:96px"></div>
                    <div class="show-mobile _5mGmSq_root" style="--height:80px"></div>
                    <div class="rWdRxW_links">
                        <h3 class="sc-KOGVz brsGUJ rWdRxW_linksLabel">Resources</h3>
                        <div class="show-mobile">
                            <article class="rWdRxW_contactLink">
                                <h4 class="ImRUSq_root ImRUSq_align-center" style="margin:0;gap:8px">
                                    <span class="sc-KOGVz gPncVY">Other</span></h4>
                                <p class="sc-KOGVz ltqnz">Get in touch with our team for press inquiries, partnerships,
                                    or other questions.</p>
                                <div class="rWdRxW_contactLinkAction">
                                    <button type="button" class="qqCMlG_root"><span class="sc-KOGVz TxVeW qqCMlG_label">hello@linear.app</span><span class="sc-KOGVz TxVeW qqCMlG_suffix" style="margin-left:8px"><span>​</span></span></button>
                                </div>
                            </article>
                        </div>
                        <article class="rWdRxW_contactLink">
                            <h4 class="ImRUSq_root ImRUSq_align-center" style="margin:0;gap:8px">
                                <span class="sc-KOGVz gPncVY">Community</span></h4>
                            <p class="sc-KOGVz ltqnz">Connect with other Linear users</p>
                            <div class="rWdRxW_contactLinkAction"><a href="/join-slack" class="qqCMlG_root I_mUeq_root"
                                    target="_blank"
                                    rel="noopener noreferrer"><span class="sc-KOGVz TxVeW qqCMlG_label">Join Slack</span><span class="sc-KOGVz TxVeW qqCMlG_suffix" style="margin-left:8px"><span>↗</span></span></a>
                            </div>
                        </article>
                        <article class="rWdRxW_contactLink">
                            <h4 class="ImRUSq_root ImRUSq_align-center" style="margin:0;gap:8px">
                                <span class="sc-KOGVz gPncVY">Documentation</span></h4>
                            <p class="sc-KOGVz ltqnz">Learn how to use every Linear feature</p>
                            <div class="rWdRxW_contactLinkAction"><a href="/docs" class="qqCMlG_root I_mUeq_root"
                                    rel="noopener"><span class="sc-KOGVz TxVeW qqCMlG_label">Linear Docs</span><span class="sc-KOGVz TxVeW qqCMlG_suffix" style="margin-left:8px"><span>→</span></span></a>
                            </div>
                        </article>
                        <article class="rWdRxW_contactLink">
                            <h4 class="ImRUSq_root ImRUSq_align-center" style="margin:0;gap:8px">
                                <span class="sc-KOGVz gPncVY">Developers</span></h4>
                            <p class="sc-KOGVz ltqnz">Build apps and integrations</p>
                            <div class="rWdRxW_contactLinkAction"><a href="/developers" class="qqCMlG_root I_mUeq_root"
                                    rel="noopener"><span class="sc-KOGVz TxVeW qqCMlG_label">Developer Docs</span><span class="sc-KOGVz TxVeW qqCMlG_suffix" style="margin-left:8px"><span>→</span></span></a>
                            </div>
                        </article>
                        <article class="rWdRxW_contactLink">
                            <h4 class="ImRUSq_root ImRUSq_align-center" style="margin:0;gap:8px">
                                <span class="sc-KOGVz gPncVY">System<span class="rWdRxW_statusDot" style="color:var(--color-green)"></span></span>
                            </h4>
                            <p class="sc-KOGVz ltqnz">All systems operational</p>
                            <div class="rWdRxW_contactLinkAction"><a href="https://linearstatus.com"
                                    class="qqCMlG_root I_mUeq_root" target="_blank"
                                    rel="noopener noreferrer"><span class="sc-KOGVz TxVeW qqCMlG_label">Check status</span><span class="sc-KOGVz TxVeW qqCMlG_suffix" style="margin-left:8px"><span>↗</span></span></a>
                            </div>
                        </article>
                    </div>
                    <div class="hide-tablet _5mGmSq_root" style="--height:240px"></div>
                    <div class="show-tablet hide-mobile _5mGmSq_root" style="--height:160px"></div>
                    <div class="show-mobile _5mGmSq_root" style="--height:96px"></div>
                </div>
            </main>
        </div><!--$--><!--/$--><!--$--><!--/$-->
        <!--$?--><template id="B:0"></template><!--/$--></div>
</body>
</html>`;
