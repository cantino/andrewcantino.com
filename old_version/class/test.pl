# Remove HTML tags (not a particularly good way to do this)
$variable = "siome text <html> more text <more html>\n";
$variable =~ s/\<[^\>]+\>//g;
print $variable;

$shouldBeNumber = "23489jkj&^*&hsbn";
# Filter input to be a number
$shouldBeNumber =~ s/[^0-9]//g;
print $shouldBeNumber . "\n";
