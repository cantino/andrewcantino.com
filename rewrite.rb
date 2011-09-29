#!/usr/bin/env ruby

text = File.read(File.dirname(__FILE__) + "/index-dev.html")
text.gsub!(/<(expando|initial|expanded)/i, '<span class="\1"')
text.gsub!(/<\/(expando|initial|expanded)/i, '</span')
text.gsub!(/\("(expando|initial|expanded)"\)/i, '(".\1")')
text.gsub!(/\('(expando|initial|expanded)'\)/i, '(".\1")')

File.open(File.dirname(__FILE__) + "/index.html", "w") do |file|
  file.print text
end
