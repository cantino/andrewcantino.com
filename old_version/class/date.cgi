#!/usr/bin/perl -T
$ENV{'PATH'} = '/bin:/usr/bin:/usr/local/bin';
use CGI;
$c = new CGI;
print $c->header();
print "<html><head><title>My first script!</title></head>\n";
print "Hello, this is my first CGI script!<br>\n";
$date = `/bin/date`;
chomp($date);
print "The date is: $date\n";
print "</body></html>";
