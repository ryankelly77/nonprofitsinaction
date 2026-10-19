<?php
/**
 * Nonprofits in Action: full EventON export for the move to Supabase.
 *
 * READ-ONLY. It changes nothing on the site. It prints one JSON document to
 * standard output.
 *
 * Run it on the live install over WP Engine's SSH gateway, from this repo:
 *
 *   ssh npinaction@npinaction.ssh.wpengine.net "wp eval-file - --skip-themes" < scripts/npia-export.php > npia-export.json
 *
 * (If the install name is not "npinaction", use the name shown in the WP Engine
 * portal for this site. Your SSH key must be added under your WP Engine user.)
 *
 * What it collects, and why each piece matters to the import:
 *
 *  - Every ajde_events post in any status, with ALL of its post meta. EventON
 *    keeps start and end as unix numbers (evcal_srow, evcal_erow), plus its
 *    time zone, repeat rules, learn-more link and status flags in meta. The
 *    import reads them all, so nothing is dropped by guessing which keys
 *    matter.
 *  - Every term in every taxonomy attached to events (locations, organizers,
 *    event types), with term meta AND EventON's own location and organizer
 *    details, which live in the evo_tax_meta option rather than in term meta.
 *    That is where venue addresses and coordinates are.
 *  - Featured image URLs, permalinks and old slugs, so every indexed
 *    /events/... address keeps working after the move.
 *  - Gravity Forms entries from the listing form(s). Each entry holds the date
 *    and time the submitter actually typed, which is the ground truth used to
 *    check every imported start time. Visitor IP addresses and browser strings
 *    are removed before output. The entries still hold contact names and
 *    emails, so do not commit the JSON to the repo.
 */

if ( ! defined( 'ABSPATH' ) ) {
	fwrite( STDERR, "Run this with WP-CLI: wp eval-file npia-export.php\n" );
	exit( 1 );
}

// Keep PHP warnings out of the JSON on standard output.
@ini_set( 'display_errors', 'stderr' );

$post_type = 'ajde_events';

$skip_meta = array( '_edit_lock', '_edit_last' );

function npia_unserialize_all( $meta ) {
	$out = array();
	foreach ( (array) $meta as $key => $values ) {
		$out[ $key ] = array_map( 'maybe_unserialize', (array) $values );
	}
	return $out;
}

/* ---- site ---------------------------------------------------------------- */

if ( ! function_exists( 'get_plugins' ) ) {
	require_once ABSPATH . 'wp-admin/includes/plugin.php';
}
$plugins = array();
foreach ( get_plugins() as $file => $data ) {
	if ( preg_match( '/eventon|gravity|redirect/i', $file . ' ' . $data['Name'] ) ) {
		$plugins[] = array(
			'file'    => $file,
			'name'    => $data['Name'],
			'version' => $data['Version'],
			'active'  => is_plugin_active( $file ),
		);
	}
}

$site = array(
	'exported_at_utc' => gmdate( 'c' ),
	'home_url'        => home_url( '/' ),
	'timezone_string' => get_option( 'timezone_string' ),
	'gmt_offset'      => get_option( 'gmt_offset' ),
	'permalink'       => get_option( 'permalink_structure' ),
	'plugins'         => $plugins,
);

/* ---- events -------------------------------------------------------------- */

$taxonomies = get_object_taxonomies( $post_type, 'names' );

$ids = get_posts( array(
	'post_type'        => $post_type,
	'post_status'      => 'any',
	'numberposts'      => -1,
	'fields'           => 'ids',
	'orderby'          => 'ID',
	'order'            => 'ASC',
	'suppress_filters' => true,
) );

// Trash is not part of 'any'; collect it too so nothing is silently missing.
$trashed = get_posts( array(
	'post_type'        => $post_type,
	'post_status'      => 'trash',
	'numberposts'      => -1,
	'fields'           => 'ids',
	'suppress_filters' => true,
) );
$ids = array_values( array_unique( array_merge( $ids, $trashed ) ) );

$events = array();
foreach ( $ids as $id ) {
	$p = get_post( $id );
	if ( ! $p ) {
		continue;
	}

	$meta = npia_unserialize_all( get_post_meta( $id ) );
	foreach ( $skip_meta as $k ) {
		unset( $meta[ $k ] );
	}

	$terms = array();
	foreach ( $taxonomies as $tax ) {
		$found = wp_get_object_terms( $id, $tax );
		if ( is_wp_error( $found ) || empty( $found ) ) {
			continue;
		}
		foreach ( $found as $t ) {
			$terms[] = array(
				'taxonomy' => $tax,
				'term_id'  => (int) $t->term_id,
				'slug'     => $t->slug,
				'name'     => $t->name,
			);
		}
	}

	$thumb_id = get_post_thumbnail_id( $id );

	$events[] = array(
		'id'                => (int) $p->ID,
		'status'            => $p->post_status,
		'title'             => $p->post_title,
		'slug'              => $p->post_name,
		'permalink'         => get_permalink( $p ),
		'content'           => $p->post_content,
		'excerpt'           => $p->post_excerpt,
		'author_id'         => (int) $p->post_author,
		'date_gmt'          => $p->post_date_gmt,
		'modified_gmt'      => $p->post_modified_gmt,
		'featured_image'    => $thumb_id ? wp_get_attachment_url( $thumb_id ) : null,
		'terms'             => $terms,
		'meta'              => $meta,
	);
}

/* ---- terms (venues, organizers, types) ----------------------------------- */

$evo_tax_meta = maybe_unserialize( get_option( 'evo_tax_meta' ) );

$terms_out = array();
foreach ( $taxonomies as $tax ) {
	$all = get_terms( array( 'taxonomy' => $tax, 'hide_empty' => false ) );
	if ( is_wp_error( $all ) ) {
		continue;
	}
	foreach ( $all as $t ) {
		$evo = null;
		if ( is_array( $evo_tax_meta ) && isset( $evo_tax_meta[ $tax ][ $t->term_id ] ) ) {
			$evo = $evo_tax_meta[ $tax ][ $t->term_id ];
		}
		$terms_out[] = array(
			'taxonomy'    => $tax,
			'term_id'     => (int) $t->term_id,
			'slug'        => $t->slug,
			'name'        => $t->name,
			'description' => $t->description,
			'parent'      => (int) $t->parent,
			'count'       => (int) $t->count,
			'term_meta'   => npia_unserialize_all( get_term_meta( $t->term_id ) ),
			'evo_meta'    => $evo,
		);
	}
}

/* ---- Gravity Forms listing entries --------------------------------------- */

$forms_out   = array();
$entries_out = array();
if ( class_exists( 'GFAPI' ) ) {
	foreach ( GFAPI::get_forms( null ) as $form ) {
		$is_listing = preg_match( '/calendar|event|listing/i', $form['title'] );

		$fields = array();
		foreach ( $form['fields'] as $f ) {
			$inputs = array();
			if ( is_array( $f->inputs ) ) {
				foreach ( $f->inputs as $in ) {
					$inputs[] = array( 'id' => (string) $in['id'], 'label' => $in['label'] );
				}
			}
			$fields[] = array(
				'id'     => (string) $f->id,
				'type'   => $f->type,
				'label'  => $f->label,
				'inputs' => $inputs,
			);
		}
		$forms_out[] = array(
			'id'         => (int) $form['id'],
			'title'      => $form['title'],
			'is_listing' => (bool) $is_listing,
			'fields'     => $is_listing ? $fields : array(),
		);

		if ( ! $is_listing ) {
			continue;
		}

		$offset = 0;
		do {
			$batch = GFAPI::get_entries(
				$form['id'],
				array( 'status' => 'active' ),
				array( 'key' => 'id', 'direction' => 'ASC' ),
				array( 'offset' => $offset, 'page_size' => 500 )
			);
			if ( is_wp_error( $batch ) ) {
				break;
			}
			foreach ( $batch as $e ) {
				unset( $e['ip'], $e['user_agent'] );
				$entries_out[] = $e;
			}
			$offset += 500;
		} while ( count( $batch ) === 500 );
	}
}

/* ---- out ----------------------------------------------------------------- */

echo wp_json_encode(
	array(
		'site'       => $site,
		'taxonomies' => $taxonomies,
		'events'     => $events,
		'terms'      => $terms_out,
		'forms'      => $forms_out,
		'entries'    => $entries_out,
		'counts'     => array(
			'events'  => count( $events ),
			'terms'   => count( $terms_out ),
			'entries' => count( $entries_out ),
		),
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);
echo "\n";
