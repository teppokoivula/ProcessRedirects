/**
 * ProcessRedirects Admin Scripts
 *
 * Provides smart URL normalization, live status code guidance, client-side table search,
 * master select-all toggle, and infinite redirect loop detection.
 */
(function($, ProcessWire) {
	'use strict';

	$(function() {

		// Read localized settings & translations passed from ProcessRedirects.module via $config->js()
		const jsConfig = (ProcessWire && ProcessWire.config && ProcessWire.config.ProcessRedirects) || {};
		const labels = jsConfig.labels || {};
		const localizedCodeDescriptions = jsConfig.codeDescriptions || {};

		/**
		 * Helper to interpolate %d, %1$d, %2$d format specifiers in translation strings
		 */
		function formatString(template, ...args) {
			if (!template) return '';
			let argIdx = 0;
			return template.replace(/%(\d+)\$d|%d/g, function(match, pos) {
				if (pos) {
					const idx = parseInt(pos, 10) - 1;
					return args[idx] !== undefined ? args[idx] : match;
				}
				const val = args[argIdx++];
				return val !== undefined ? val : match;
			});
		}

		// =========================================================================
		// 1. EDIT / ADD FORM: Smart URL Normalization & Validation
		// =========================================================================
		const $fromInput = $('#redirect_from');
		const $toInput = $('#redirect_to');
		const $pageSelect = $('#select_page');
		const $codeSelect = $('#redirect_code');
		const $editForm = $('#ProcessRedirectsEditForm');

		if ($fromInput.length) {

			/**
			 * Normalize Redirect From path on blur:
			 * - Trims whitespace
			 * - Automatically extracts relative pathname if user pasted a full URL
			 * - Enforces leading slash
			 * - Safely encodes spaces to %20 without corrupting other UTF-8 chars
			 */
			$fromInput.on('blur', function() {
				let val = $(this).val().trim();
				if (!val) return;

				// If full URL was pasted, parse pathname + search
				try {
					if (/^https?:\/\//i.test(val)) {
						const urlObj = new URL(val, window.location.origin);
						val = urlObj.pathname + urlObj.search;
					}
				} catch (e) {
					// Fallback if URL parsing fails
				}

				// Normalize leading slashes
				val = '/' + val.replace(/^\/+/, '');

				// Safely encode all whitespace to %20
				val = val.replace(/\s+/g, '%20');

				$(this).val(val);
			});
		}

		let selectedPageUrl = $pageSelect.attr('data-url') || '';
		if ($pageSelect.length) {
			// Track selected internal page URL for loop prevention and external field sync
			$pageSelect.on('pageSelected', function(event, data) {
				if (data && data.url && data.url.length) {
					selectedPageUrl = data.url;
					if (!$toInput.val() || $('input[name="target_type"]:checked').val() === 'internal') {
						$toInput.val(data.url);
					}
				}
			});

			$('input[name="target_type"]').on('change', function() {
				if ($(this).val() === 'external' && !$toInput.val() && selectedPageUrl) {
					$toInput.val(selectedPageUrl);
				}
			});
		}

		if ($codeSelect.length) {

			// Default HTTP Status code explanations (fallback if translations not loaded)
			const defaultCodeDescriptions = {
				301: {
					type: 'success',
					text: '301 Moved Permanently: Best for permanent SEO changes. Fully cached by browsers and search engines; passes link equity.'
				},
				302: {
					type: 'warning',
					text: '302 Found (Temporary): Standard temporary redirect. Search engines maintain the original URL in the index.'
				},
				303: {
					type: 'primary',
					text: '303 See Other: Directs client to target using HTTP GET method. Ideal for Post/Redirect/Get patterns.'
				},
				307: {
					type: 'warning',
					text: '307 Temporary Redirect: Modern temporary redirect strictly preserving HTTP request method (POST remains POST).'
				},
				308: {
					type: 'success',
					text: '308 Permanent Redirect: Modern permanent redirect strictly preserving HTTP request method and caching behavior.'
				}
			};

			// Merge server-provided localized explanations over defaults
			const codeDescriptions = $.extend(true, {}, defaultCodeDescriptions, localizedCodeDescriptions);

			const $helpContainer = $('<div id="redirect_code_help" class="uk-margin-small-top uk-text-small"></div>');
			$codeSelect.after($helpContainer);


			function updateCodeHelp() {
				const selectedCode = parseInt($codeSelect.val(), 10);
				const info = codeDescriptions[selectedCode];
				if (info) {
					$helpContainer.empty();
					$helpContainer.append($('<i class="fa fa-info-circle uk-margin-small-right" aria-hidden="true"></i>'));
					$helpContainer.append(document.createTextNode(info.text));
				} else {
					$helpContainer.empty();
				}
			}

			$codeSelect.on('change', updateCodeHelp);
			updateCodeHelp();
		}

		if ($editForm.length) {

			/**
			 * Validate form values and prevent infinite loops before submit
			 */
			$editForm.on('submit', function(event) {
				const targetType = $('input[name="target_type"]:checked').val() || 'internal';
				const toVal = $toInput.val().trim();
				const pageVal = $pageSelect.val() ? $pageSelect.val().trim() : '';

				// Ensure target destination is provided based on destination type
				if (targetType === 'internal') {
					if (!pageVal || pageVal === '0') {
						event.preventDefault();
						const alertMsg = labels.noRedirectTo || $editForm.attr('data-no-redirect-to') || 'Please select target page.';
						if (ProcessWire && ProcessWire.alert) {
							ProcessWire.alert(alertMsg);
						} else {
							alert(alertMsg);
						}
						if (typeof Inputfields === 'object' && Inputfields.highlight) {
							Inputfields.highlight('select_page');
						}
						return false;
					}
				} else {
					if (toVal === '') {
						event.preventDefault();
						const alertMsg = labels.noTargetUrl || $editForm.attr('data-no-target-url') || 'Please enter target URL.';
						if (ProcessWire && ProcessWire.alert) {
							ProcessWire.alert(alertMsg);
						} else {
							alert(alertMsg);
						}
						$toInput.focus();
						return false;
					}
				}

				// Prevent infinite redirect loops (Redirect From === Redirect To)
				let fromNorm = $fromInput.val().trim().replace(/\/+$/, '');
				let targetNorm = targetType === 'internal' ? (selectedPageUrl || '') : toVal;

				try {
					if (/^https?:\/\//i.test(targetNorm)) {
						const urlObj = new URL(targetNorm, window.location.origin);
						if (urlObj.origin === window.location.origin) {
							targetNorm = urlObj.pathname + urlObj.search;
						}
					}
				} catch (e) {}

				targetNorm = targetNorm.replace(/\/+$/, '');

				if (fromNorm && targetNorm && fromNorm === targetNorm) {
					event.preventDefault();
					const loopMsg = labels.loopError || $editForm.attr('data-loop-error') || 'Redirect From and Redirect To cannot be identical (would cause an infinite redirect loop).';
					if (ProcessWire && ProcessWire.alert) {
						ProcessWire.alert(loopMsg);
					} else {
						alert(loopMsg);
					}
					if (targetType === 'external') {
						$toInput.focus();
					}
					return false;
				}
			});
		}

		// =========================================================================
		// 2. ADMIN TABLE: Pagination, Live Search across All Rows, and Bulk Delete
		// =========================================================================
		const $redirectsForm = $('#redirects_form');
		const $searchInput = $('#redirects_table_search');
		const $pageSizeSelect = $('#redirects_page_size');
		const $paginationContainer = $('#redirects_pagination_container');
		const $selectAll = $('#select_all_redirects');

		if ($redirectsForm.length) {

			const $table = $redirectsForm.find('table.AdminDataTable, table.uk-table').first();
			const $tbody = $table.find('tbody');
			const $allRows = $tbody.find('tr');
			const totalRows = $allRows.length;

			if (totalRows) {

				// Build container structure for page info and pagination controls
				const $pageInfo = $('<div class="redirects-page-info"></div>');
				const $paginationNav = $('<ul class="uk-pagination uk-margin-remove"></ul>');
				$paginationContainer.empty().append($pageInfo).append($paginationNav);

				// Pre-cache row text for fast sub-millisecond multi-term search
				const rowCache = [];
				$allRows.each(function() {
					const $tr = $(this);
					// Grab text content from all data cells except the final checkbox cell
					const searchContent = $tr.children('td').not(':last-child').text().toLowerCase();
					rowCache.push({
						$tr: $tr,
						trEl: this,
						text: searchContent
					});
				});

				let matchingRows = rowCache.slice();
				let currentPage = 1;

				// Remember user's page size preference in localStorage
				const STORAGE_KEY = 'ProcessRedirects_pageSize';
				const savedPageSize = localStorage.getItem(STORAGE_KEY);
				if (savedPageSize && ['10', '25', '50', '100', 'all'].indexOf(savedPageSize) !== -1) {
					$pageSizeSelect.val(savedPageSize);
				}

				function getPageSize() {
					return $pageSizeSelect.val() || '50';
				}

				/**
				 * Generate sliding-window page numbers with ellipsis
				 */
				function getPaginationPageNumbers(current, total) {
					if (total <= 7) {
						const pages = [];
						for (let i = 1; i <= total; i++) pages.push(i);
						return pages;
					}

					if (current <= 4) {
						return [1, 2, 3, 4, 5, '...', total];
					}

					if (current >= total - 3) {
						return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
					}

					return [1, '...', current - 1, current, current + 1, '...', total];
				}

				/**
				 * Re-render table slice, info summary, and pagination buttons
				 */
				function render() {
					const totalMatching = matchingRows.length;
					const pageSizeVal = getPageSize();
					const isAll = (pageSizeVal === 'all');
					const pageSize = isAll ? Math.max(totalMatching, 1) : (parseInt(pageSizeVal, 10) || 50);
					const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalMatching / pageSize));

					if (currentPage > totalPages) currentPage = totalPages;
					if (currentPage < 1) currentPage = 1;

					const startIndex = (currentPage - 1) * pageSize;
					const endIndex = Math.min(startIndex + pageSize, totalMatching);

					// 1. Manage row visibility
					$tbody.find('.redirects-no-results').remove();

					if (totalMatching === 0) {
						$allRows.hide();
						const colSpan = $table.find('thead th').length || 7;
						const noResultsMsg = labels.noResults || 'No redirects matching your search.';
						const $noResultsRow = $('<tr class="redirects-no-results"><td class="uk-text-center uk-text-muted" style="padding: 28px;"></td></tr>');
						$noResultsRow.find('td').attr('colspan', colSpan).text(noResultsMsg);
						$tbody.append($noResultsRow);

						$pageInfo.text(noResultsMsg);
						$paginationNav.empty();
						updateSelectAllState();
						return;
					}

					// Fast batch display: hide all rows, show only current page slice
					$allRows.hide();
					const visibleTrElements = [];
					for (let i = startIndex; i < endIndex; i++) {
						visibleTrElements.push(matchingRows[i].trEl);
					}
					$(visibleTrElements).show();

					// 2. Update page info text
					const isFiltered = (totalMatching < totalRows);
					let infoText = '';
					if (isAll || totalMatching <= pageSize) {
						if (isFiltered) {
							const tmpl = labels.showingAllFiltered || 'Showing all %1$d matching (filtered from %2$d)';
							infoText = formatString(tmpl, totalMatching, totalRows);
						} else {
							const tmpl = labels.showingAll || 'Showing all %d redirects';
							infoText = formatString(tmpl, totalRows);
						}
					} else {
						const displayStart = startIndex + 1;
						const displayEnd = endIndex;
						if (isFiltered) {
							const tmpl = labels.showingRangeFiltered || 'Showing %1$d–%2$d of %3$d matching (filtered from %4$d)';
							infoText = formatString(tmpl, displayStart, displayEnd, totalMatching, totalRows);
						} else {
							const tmpl = labels.showingRange || 'Showing %1$d–%2$d of %3$d redirects';
							infoText = formatString(tmpl, displayStart, displayEnd, totalRows);
						}
					}
					$pageInfo.text(infoText);

					// 3. Render Pagination Navigation links
					$paginationNav.empty();
					if (totalPages > 1) {
						// Previous button
						const prevLabel = labels.previous || 'Previous';
						if (currentPage > 1) {
							$paginationNav.append(
								$('<li></li>').append(
									$('<a href="#"></a>').attr('data-page', currentPage - 1).html('<i class="fa fa-angle-left" aria-hidden="true"></i> ' + prevLabel)
								)
							);
						} else {
							$paginationNav.append(
								$('<li class="uk-disabled"></li>').append(
									$('<span></span>').html('<i class="fa fa-angle-left" aria-hidden="true"></i> ' + prevLabel)
								)
							);
						}

						// Page numbers with ellipsis
						const pages = getPaginationPageNumbers(currentPage, totalPages);
						for (let i = 0; i < pages.length; i++) {
							const p = pages[i];
							if (p === '...') {
								$paginationNav.append($('<li class="uk-disabled"><span>…</span></li>'));
							} else if (p === currentPage) {
								$paginationNav.append(
									$('<li class="uk-active"></li>').append(
										$('<span aria-current="page"></span>').text(p)
									)
								);
							} else {
								$paginationNav.append(
									$('<li></li>').append(
										$('<a href="#"></a>').attr('data-page', p).text(p)
									)
								);
							}
						}

						// Next button
						const nextLabel = labels.next || 'Next';
						if (currentPage < totalPages) {
							$paginationNav.append(
								$('<li></li>').append(
									$('<a href="#"></a>').attr('data-page', currentPage + 1).html(nextLabel + ' <i class="fa fa-angle-right" aria-hidden="true"></i>')
								)
							);
						} else {
							$paginationNav.append(
								$('<li class="uk-disabled"></li>').append(
									$('<span></span>').html(nextLabel + ' <i class="fa fa-angle-right" aria-hidden="true"></i>')
								)
							);
						}
					}

					// 4. Update select-all checkbox for current visible slice
					updateSelectAllState();
				}

				// --- Search Filtering Across ALL Rows ---
				let searchTimeout = null;

				function filterRows() {
					const query = $searchInput.val().trim().toLowerCase();

					if (!query) {
						matchingRows = rowCache.slice();
					} else {
						const terms = query.split(/\s+/).filter(Boolean);
						matchingRows = rowCache.filter(function(item) {
							for (let i = 0; i < terms.length; i++) {
								if (item.text.indexOf(terms[i]) === -1) {
									return false;
								}
							}
							return true;
						});
					}

					currentPage = 1;
					render();
				}

				$searchInput.on('input', function() {
					clearTimeout(searchTimeout);
					searchTimeout = setTimeout(filterRows, 120);
				});

				$searchInput.on('keydown', function(e) {
					if (e.key === 'Escape') {
						$(this).val('');
						filterRows();
					}
				});

				// --- Page Size Selection ---
				$pageSizeSelect.on('change', function() {
					const val = $(this).val();
					try {
						localStorage.setItem(STORAGE_KEY, val);
					} catch (e) {}
					currentPage = 1;
					render();
				});

				// --- Pagination Click Handling ---
				$paginationNav.on('click', 'a[data-page]', function(e) {
					e.preventDefault();
					const targetPage = parseInt($(this).attr('data-page'), 10);
					if (targetPage && targetPage !== currentPage) {
						currentPage = targetPage;
						render();

						// Smooth scroll to top of table if user scrolled down
						const tableTop = $table.offset().top - 70;
						if ($(window).scrollTop() > tableTop) {
							$('html, body').animate({ scrollTop: tableTop }, 150);
						}
					}
				});

				// --- Master "Select All" Toggle for Current Page ---
				function getVisibleCheckboxes() {
					return $allRows.filter(':visible').find('input[name="delete[]"]');
				}

				function updateSelectAllState() {
					if (!$selectAll.length) return;
					const $visibleCheckboxes = getVisibleCheckboxes();
					const totalVisible = $visibleCheckboxes.length;
					const checkedVisible = $visibleCheckboxes.filter(':checked').length;

					if (totalVisible === 0 || checkedVisible === 0) {
						$selectAll.prop('checked', false);
						$selectAll.prop('indeterminate', false);
					} else if (checkedVisible === totalVisible) {
						$selectAll.prop('checked', true);
						$selectAll.prop('indeterminate', false);
					} else {
						$selectAll.prop('checked', false);
						$selectAll.prop('indeterminate', true);
					}
				}

				if ($selectAll.length) {
					$selectAll.on('change', function() {
						const isChecked = $(this).is(':checked');
						const $visibleCheckboxes = getVisibleCheckboxes();
						$visibleCheckboxes.prop('checked', isChecked).trigger('change');
					});

					$redirectsForm.on('change', 'input[name="delete[]"]', function() {
						const $row = $(this).closest('tr');
						$row.toggleClass('row-selected-for-delete', $(this).is(':checked'));
						updateSelectAllState();
					});
				}

				// --- Bulk Delete Confirmation ---
				let deleteConfirmed = false;
				$redirectsForm.on('submit', function(event) {
					if (deleteConfirmed) return;

					const $checked = $redirectsForm.find('input[name="delete[]"]:checked');
					const count = $checked.length;
					if (!count) {
						event.preventDefault();
						const alertMsg = labels.alertSelect || $redirectsForm.attr('data-alert-select') || 'You need to select at least one item to delete first.';
						if (ProcessWire && ProcessWire.alert) {
							ProcessWire.alert(alertMsg);
						} else {
							alert(alertMsg);
						}
						return;
					}

					event.preventDefault();
					const confirmTemplate = count > 1
						? (labels.confirmDeleteCount || 'Are you sure you want to delete %d selected redirects?')
						: (labels.confirmDelete || $redirectsForm.attr('data-confirm-delete') || 'Are you sure you want to delete selected redirects?');
					const confirmMsg = formatString(confirmTemplate, count);

					if (ProcessWire && ProcessWire.confirm) {
						ProcessWire.confirm(confirmMsg, function() {
							deleteConfirmed = true;
							$redirectsForm.trigger('submit');
						});
					} else if (window.confirm(confirmMsg)) {
						deleteConfirmed = true;
						$redirectsForm.trigger('submit');
					}
				});

				// Initial Render
				render();
			}
		}

	});
})(jQuery, window.ProcessWire || {});
